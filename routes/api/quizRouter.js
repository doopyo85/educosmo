const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { checkRole } = require('../../lib_login/authMiddleware');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Promise 기반 exec 함수
const execPromise = util.promisify(exec);

// getSheetData 함수 가져오기 (수정된 방식)
let getSheetData;
try {
  const serverModule = require('../../server');
  getSheetData = serverModule.getSheetData;
} catch (error) {
  console.error('getSheetData 로드 실패:', error);
  // 폴백 함수
  getSheetData = async () => [];
}

/**
 * 퀴즈 문제 데이터 가져오기
 * URL: /api/quiz/get-quiz-problem
 * Method: GET
 * Query params: examName, problemNumber (optional)
 */
router.get('/get-quiz-problem', async (req, res) => {
  try {
    const { examName, problemNumber } = req.query;

    if (!examName) {
      return res.status(400).json({
        success: false,
        message: '시험명(examName)이 필요합니다.'
      });
    }

    console.log('퀴즈 문제 요청:', { examName, problemNumber });

    // 🔥 수정: 범위를 M열까지 확장 (예제파일URL 컬럼 추가)
    const problemsData = await getSheetData('problems!A2:N500');

    if (!problemsData || problemsData.length === 0) {
      return res.status(404).json({
        success: false,
        message: '문제 데이터를 찾을 수 없습니다.'
      });
    }

    console.log('전체 문제 데이터 수:', problemsData.length);

    // 요청된 시험에 맞는 문제 찾기 (대소문자 구분 없이)
    let matchingProblems = problemsData.filter(problem =>
      problem[1] && problem[1].toLowerCase() === examName.toLowerCase()
    );

    console.log('매칭된 문제 수:', matchingProblems.length);

    // 특정 문제 번호가 요청된 경우
    if (problemNumber) {
      const problemKey = `p${problemNumber.toString().padStart(2, '0')}`;

      matchingProblems = matchingProblems.filter(problem =>
        problem[2] && problem[2].toLowerCase() === problemKey.toLowerCase()
      );

      console.log('특정 문제 매칭 결과:', matchingProblems.length);

      if (matchingProblems.length === 0) {
        return res.status(404).json({
          success: false,
          message: `${examName}의 문제 ${problemNumber}를 찾을 수 없습니다.`
        });
      }

      // 🔥 수정: 새로운 컬럼 구조에 맞게 매핑
      const problem = matchingProblems[0];

      // 실제 구글 시트 컬럼 구조 (예제파일URL 추가):
      // A: URL, B: 시험지명, C: 문제번호, D: 개념, E: 파일URL, F: 예제파일URL, G: 정답파일URL, H: 해설파일URL, I: answerType, J: 정답, K: 인풋/아웃풋, L: 난이도, M: 객관식/주관식, N: Tags
      const quizData = {
        url: problem[0] || '',                    // A: URL
        examName: problem[1] || '',               // B: 시험지명
        problemNumber: problem[2] || '',          // C: 문제번호
        concept: problem[3] || '',                // D: 개념
        fileUrl: problem[4] || '',                // E: 파일URL (문제 파일)
        exampleFileUrl: '',                       // F: 예제파일URL (삭제됨)
        answerFileUrl: problem[5] || '',          // G -> F: 정답파일URL
        explanationFileUrl: problem[6] || '',     // H -> G: 해설파일URL
        answerType: problem[7] || 'number',       // I -> H: answerType
        correctAnswer: problem[8] || '',          // J -> I: 정답 (JSON 형태)
        testCases: problem[9] || '[]',            // K -> J: 인풋/아웃풋 (테스트케이스)
        difficulty: problem[10] || '1',           // L -> K: 난이도
        questionType: problem[11] || '객관식',     // M -> L: 객관식/주관식
        tags: problem[12] || ''                   // N -> M: Tags
      };

      console.log('파싱된 퀴즈 데이터:', quizData);

      return res.json({
        success: true,
        quizData
      });
    }

    // 모든 문제 반환 (문제 번호가 지정되지 않은 경우)
    const quizDataList = matchingProblems.map(problem => ({
      url: problem[0] || '',
      examName: problem[1] || '',
      problemNumber: problem[2] || '',
      concept: problem[3] || '',
      fileUrl: problem[4] || '',
      exampleFileUrl: '',
      answerFileUrl: problem[5] || '',
      explanationFileUrl: problem[6] || '',
      answerType: problem[7] || 'number',
      correctAnswer: problem[8] || '',
      testCases: problem[9] || '[]',
      difficulty: problem[10] || '1',
      questionType: problem[11] || '객관식',
      tags: problem[12] || ''
    }));

    return res.json({
      success: true,
      quizDataList
    });

  } catch (error) {
    console.error('Quiz problem retrieval error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 정답 제출
 * URL: /api/quiz/submit-answer
 * Method: POST
 * Body: { userID, examName, problemNumber, userAnswer, answerType, editorCode?, testCases? }
 */
router.post('/submit-answer', async (req, res) => {
  try {
    const {
      userID,
      examName,
      problemNumber,
      userAnswer,
      answerType = 'number',
      editorCode,
      testCases
    } = req.body;

    if (!userID || !examName || !problemNumber || !userAnswer) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다. (userID, examName, problemNumber, userAnswer)'
      });
    }

    console.log('📄 정답 제출 요청:', { userID, examName, problemNumber, userAnswer, answerType });
    console.log('📅 요청 데이터 타입:', {
      userAnswer: typeof userAnswer,
      answerType: typeof answerType
    });

    // 🔥 수정: 범위를 N열까지 확장 (예제파일URL 컬럼 추가)
    const problemsData = await getSheetData('problems!A2:N500');

    // 요청된 시험/문제에 맞는 문제 찾기
    const problem = problemsData.find(p =>
      p[1] && p[1].toLowerCase() === examName.toLowerCase() &&
      p[2] && p[2].toLowerCase() === problemNumber.toLowerCase()
    );

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: '문제를 찾을 수 없습니다.'
      });
    }

    // 🔥 수정: 새로운 컬럼 구조에 맞게 정답 및 문제 타입 가져오기
    const correctAnswerData = problem[8] || '';      // I: 정답
    const questionType = problem[11] || '객관식';     // L: 객관식/주관식
    const problemTestCases = problem[9] || '[]';    // J: 인풋/아웃풋
    const actualAnswerType = problem[7] || 'number'; // H: answerType

    console.log('📋 문제 데이터:', { correctAnswerData, questionType, actualAnswerType });
    console.log('📊 데이터 타입 상세:', {
      correctAnswerData: typeof correctAnswerData,
      questionType: typeof questionType,
      actualAnswerType: typeof actualAnswerType
    });

    // 정답 검증
    let isCorrect = false;
    let executionResults = null;
    let feedbackMessage = '';

    if (questionType === '코딩') {
      // 코딩 문제는 테스트 케이스를 실행하여 검증
      try {
        const result = await validateCodingAnswer(editorCode, problemTestCases);
        isCorrect = result.isCorrect;
        executionResults = result.executionResults;
        feedbackMessage = isCorrect ? '모든 테스트 케이스를 통과했습니다!' : '일부 테스트 케이스에서 실패했습니다.';
      } catch (error) {
        console.error('코드 실행 오류:', error);
        return res.status(500).json({
          success: false,
          message: '코드 실행 중 오류가 발생했습니다: ' + error.message
        });
      }
    } else {
      // 🔥 수정: 객관식/주관식 문제 검증 (JSON 파싱 포함)
      isCorrect = validateAnswer(userAnswer, correctAnswerData, actualAnswerType, questionType);

      if (isCorrect) {
        feedbackMessage = '정답입니다!';
      } else {
        // 정답 정보 제공 (객관식의 경우)
        if (questionType === '객관식') {
          try {
            const answerData = JSON.parse(correctAnswerData);
            const correctChoice = answerData.answer;
            feedbackMessage = `오답입니다. 정답은 ${correctChoice}번입니다.`;
          } catch (e) {
            feedbackMessage = '오답입니다. 다시 시도해보세요.';
          }
        } else {
          feedbackMessage = '오답입니다. 다시 시도해보세요.';
        }
      }
    }

    // 제출 결과 저장
    const timestamp = new Date().toISOString();
    const userId = await getUserIdFromUsername(userID);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // DB에 결과 저장
    await saveQuizResult(userId, examName, problemNumber, userAnswer, isCorrect, timestamp, executionResults);

    console.log('🏆 정답 검증 완료:', {
      isCorrect,
      feedbackMessage,
      사용자답: userAnswer,
      사용자답타입: typeof userAnswer,
      정답데이터: correctAnswerData,
      문제타입: questionType
    });

    // 응답
    return res.json({
      success: true,
      isCorrect,
      message: feedbackMessage,
      executionResults
    });
  } catch (error) {
    console.error('Answer submission error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 사용자 진행상황 가져오기
 * URL: /api/quiz/get-user-progress
 * Method: GET
 * Query params: userID, examName (optional)
 */
router.get('/get-user-progress', async (req, res) => {
  try {
    const { userID, examName } = req.query;

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: '사용자 ID가 필요합니다.'
      });
    }

    const userId = await getUserIdFromUsername(userID);

    if (!userId) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 쿼리 조건 설정
    let query = 'SELECT * FROM QuizResults WHERE user_id = ?';
    let params = [userId];

    // 특정 시험에 대한 진행상황만 요청된 경우
    if (examName) {
      query += ' AND exam_name = ?';
      params.push(examName);
    }

    // 최신 결과만 가져오도록 정렬
    query += ' ORDER BY timestamp DESC';

    const results = await db.queryDatabase(query, params);

    // 사용자별 진행상황 구성
    const progress = {};

    results.forEach(result => {
      const key = `${result.exam_name}_${result.problem_number}`;

      // 이미 저장된 결과가 없거나 더 최신 결과인 경우만 저장
      if (!progress[key] || new Date(result.timestamp) > new Date(progress[key].timestamp)) {
        progress[key] = {
          timestamp: result.timestamp,
          isCorrect: result.is_correct === 1,
          userAnswer: result.user_answer
        };
      }
    });

    return res.json({
      success: true,
      progress
    });

  } catch (error) {
    console.error('User progress retrieval error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 🔥 수정: 정답 검증 함수 - JSON 데이터 지원 및 객관식 처리 개선 + 디버깅 강화
 */
function validateAnswer(userAnswer, correctAnswerData, answerType, questionType) {
  console.log('🔍 정답 검증 시작:', {
    userAnswer,
    userAnswerType: typeof userAnswer,
    correctAnswerData,
    answerType,
    questionType
  });

  try {
    // 객관식 문제의 경우 JSON 파싱 시도
    if (questionType === '객관식') {
      try {
        const answerData = JSON.parse(correctAnswerData);
        const correctChoice = answerData.answer;

        console.log('✅ 객관식 정답 데이터 파싱 성공:', answerData);
        console.log('🔎 비교 데이터:', {
          사용자답: userAnswer,
          사용자답타입: typeof userAnswer,
          정답: correctChoice,
          정답타입: typeof correctChoice
        });

        // 🔥 수정: 문자열로 변환하여 비교 (데이터 타입 불일치 해결)
        const userAnswerStr = String(userAnswer).trim();
        const correctChoiceStr = String(correctChoice).trim();

        console.log('🔎 변환후 비교:', {
          사용자답: userAnswerStr,
          정답: correctChoiceStr,
          일치여부: userAnswerStr === correctChoiceStr
        });

        const isCorrect = userAnswerStr === correctChoiceStr;

        console.log(isCorrect ? '✅ 정답!' : '❌ 오답!');

        return isCorrect;

      } catch (jsonError) {
        console.error('❌ JSON 파싱 실패, 문자열로 비교:', jsonError);
        // JSON 파싱 실패 시 문자열로 직접 비교
        const userAnswerStr = String(userAnswer).trim();
        const correctAnswerStr = String(correctAnswerData).trim();

        console.log('🔎 폴백 비교:', {
          사용자답: userAnswerStr,
          정답: correctAnswerStr,
          일치여부: userAnswerStr === correctAnswerStr
        });

        return userAnswerStr === correctAnswerStr;
      }
    }

    // 주관식 및 기타 문제 유형 처리
    if (answerType === 'exact') {
      // 정확한 문자열 일치
      const userAnswerStr = String(userAnswer).trim();
      const correctAnswerStr = String(correctAnswerData).trim();
      console.log('📝 exact 비교:', { userAnswerStr, correctAnswerStr });
      return userAnswerStr === correctAnswerStr;

    } else if (answerType === 'pattern') {
      // 정규식 패턴 일치
      try {
        const pattern = new RegExp(correctAnswerData);
        const result = pattern.test(String(userAnswer));
        console.log('🔍 pattern 비교:', { userAnswer, pattern: correctAnswerData, result });
        return result;
      } catch (e) {
        console.error('Invalid regex pattern:', e);
        return false;
      }

    } else if (answerType === 'contains') {
      // 부분 문자열 포함 여부
      const userAnswerStr = String(userAnswer).toLowerCase().trim();
      const correctAnswerStr = String(correctAnswerData).toLowerCase().trim();
      const result = correctAnswerStr.includes(userAnswerStr) || userAnswerStr.includes(correctAnswerStr);
      console.log('🔍 contains 비교:', { userAnswerStr, correctAnswerStr, result });
      return result;

    } else if (answerType === 'number') {
      // 숫자 값 비교 (오차 허용)
      const tolerance = 0.001;

      // 사용자 답안 숫자 변환
      const userNum = parseFloat(userAnswer);

      // 정답 숫자 변환 (객관식의 경우 JSON에서 정답 추출)
      let correctNum;
      try {
        const answerData = JSON.parse(correctAnswerData);
        correctNum = parseFloat(answerData.answer);
        console.log('🔢 JSON에서 숫자 추출:', correctNum);
      } catch (e) {
        correctNum = parseFloat(correctAnswerData);
        console.log('🔢 직접 숫자 변환:', correctNum);
      }

      console.log('🔢 숫자 비교:', { userNum, correctNum, 둘다숫자: !isNaN(userNum) && !isNaN(correctNum) });

      if (isNaN(userNum) || isNaN(correctNum)) {
        // 숫자가 아닌 경우 문자열 비교
        const userAnswerStr = String(userAnswer).trim();
        const correctAnswerStr = String(correctNum).trim();
        console.log('🔤 숫자 변환 실패, 문자열 비교:', { userAnswerStr, correctAnswerStr });
        return userAnswerStr === correctAnswerStr;
      }

      const diff = Math.abs(userNum - correctNum);
      const result = diff < tolerance;
      console.log('🔢 숫자 비교 결과:', { diff, tolerance, result });
      return result;
    }

    // 기본값: 정확한 일치 (문자열 변환 후)
    const userAnswerStr = String(userAnswer).trim();
    const correctAnswerStr = String(correctAnswerData).trim();

    console.log('🔄 기본 문자열 비교:', { userAnswerStr, correctAnswerStr });

    return userAnswerStr === correctAnswerStr;

  } catch (error) {
    console.error('❌ 정답 검증 중 오류:', error);
    return false;
  }
}

/**
 * 사용자명으로 사용자 ID 가져오기
 */
async function getUserIdFromUsername(username) {
  try {
    const query = 'SELECT id FROM Users WHERE userID = ?';
    const results = await db.queryDatabase(query, [username]);

    if (results && results.length > 0) {
      return results[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

/**
 * 코딩 답변 검증
 */
async function validateCodingAnswer(code, testCasesStr) {
  // 테스트 케이스 파싱
  const testCases = typeof testCasesStr === 'string' ? JSON.parse(testCasesStr) : testCasesStr;

  if (!Array.isArray(testCases) || testCases.length === 0) {
    return { isCorrect: false, executionResults: '테스트 케이스가 없습니다.' };
  }

  // 임시 파일 생성
  const tempFile = path.join(__dirname, '../../temp_quiz_' + Date.now() + '.py');
  fs.writeFileSync(tempFile, code);

  let allPassed = true;
  let results = [];

  try {
    // 각 테스트 케이스 실행
    for (const testCase of testCases) {
      const { input, output } = testCase;

      // Python 코드 실행 (입력값 제공)
      const command = `python3 "${tempFile}"`;

      const { stdout, stderr } = await execWithInput(command, input);

      // 출력 결과 비교 (공백 및 줄바꿈 정규화)
      const normalizedOutput = output.trim();
      const normalizedStdout = stdout.trim();

      const passed = normalizedStdout === normalizedOutput;

      if (!passed) {
        allPassed = false;
      }

      results.push({
        input,
        expectedOutput: normalizedOutput,
        actualOutput: normalizedStdout,
        passed,
        error: stderr
      });
    }
  } catch (error) {
    return {
      isCorrect: false,
      executionResults: `코드 실행 오류: ${error.message}`
    };
  } finally {
    // 임시 파일 삭제
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.error('Error deleting temporary file:', e);
    }
  }

  return {
    isCorrect: allPassed,
    executionResults: results
  };
}

/**
 * 입력값을 제공하여 명령어 실행
 */
async function execWithInput(command, input) {
  return new Promise((resolve, reject) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error && error.code !== 0) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });

    // 표준 입력으로 값 제공
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

/**
 * 퀴즈 결과 저장
 */
async function saveQuizResult(userId, examName, problemNumber, userAnswer, isCorrect, timestamp, executionResults) {
  try {
    // 테이블 존재 여부 확인
    const tables = await db.queryDatabase("SHOW TABLES LIKE 'QuizResults'");

    if (tables.length === 0) {
      // 테이블 생성
      await db.queryDatabase(`
        CREATE TABLE IF NOT EXISTS QuizResults (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          exam_name VARCHAR(255) NOT NULL,
          problem_number VARCHAR(10) NOT NULL,
          user_answer TEXT,
          is_correct TINYINT(1) NOT NULL DEFAULT 0,
          timestamp DATETIME NOT NULL,
          execution_results TEXT,
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);

      // 인덱스 생성
      await db.queryDatabase(
        "CREATE INDEX idx_quiz_user_problem ON QuizResults(user_id, exam_name, problem_number)"
      );
    }

    // 결과 저장
    await db.queryDatabase(
      `INSERT INTO QuizResults 
       (user_id, exam_name, problem_number, user_answer, is_correct, timestamp, execution_results)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        examName,
        problemNumber,
        userAnswer,
        isCorrect ? 1 : 0,
        timestamp,
        executionResults ? JSON.stringify(executionResults) : null
      ]
    );

    return true;
  } catch (error) {
    console.error('Error saving quiz result:', error);
    throw error;
  }
}

module.exports = router;