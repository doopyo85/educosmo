const express = require('express');
const router = express.Router();
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { checkPageAccess } = require('../lib_login/authMiddleware');

// 실행 중인 Python 프로세스 관리
const activePythonProcesses = new Map();

// Python 메뉴 데이터 API
router.get('/api/get-python-data', async (req, res) => {
    try {
        console.log('Python 메뉴 데이터 API 요청');

        let getSheetData;
        try {
            getSheetData = req.app.get('getSheetData');
            if (!getSheetData) throw new Error('getSheetData function not found in app');
        } catch (e) {
            try {
                const server = require('../server');
                getSheetData = server.getSheetData;
                if (!getSheetData) throw new Error('getSheetData function not found in server module');
            } catch (e2) {
                return res.status(500).json({
                    success: false,
                    error: '데이터 로드 함수를 찾을 수 없습니다',
                    message: e2.message
                });
            }
        }

        const data = await getSheetData('Python!A2:F100');
        console.log(`Python 메뉴 데이터 로드 완료: ${data ? data.length : 0}개 항목`);

        res.json({
            success: true,
            data: data || [],
            count: data ? data.length : 0
        });

    } catch (error) {
        console.error('Python 메뉴 데이터 로드 오류:', error);
        res.status(500).json({
            success: false,
            error: '파이썬 데이터를 불러오는 중 오류가 발생했습니다.',
            message: error.message
        });
    }
});

// 🔥 최종 수정: 대화형 Python 실행 시작
router.post('/api/run-python-interactive', async (req, res) => {
    console.log('=== 대화형 Python 코드 실행 요청 ===');

    try {
        const { code, sessionId = Date.now().toString() } = req.body;
        console.log('세션 ID:', sessionId);
        console.log('실행할 코드:\n', code);

        // 코드 검증
        if (!code || typeof code !== 'string' || code.trim() === '') {
            return res.json({
                success: false,
                error: '유효하지 않은 코드입니다.'
            });
        }

        // input() 함수 확인
        const hasInput = code.includes('input(');
        if (!hasInput) {
            return executeNormalPython(code, req, res);
        }

        // 대화형 Python 프로세스 시작
        await startInteractivePython(code, sessionId, res);

    } catch (error) {
        console.error('대화형 Python 실행 API 오류:', error);
        res.json({
            success: false,
            error: `서버 오류: ${error.message}`
        });
    }
});

// 🔥 최종 수정: Python 실행 재개
router.post('/api/resume-python', async (req, res) => {
    console.log('=== Python 실행 재개 요청 ===');

    try {
        const { input, sessionId } = req.body;
        console.log('세션 ID:', sessionId);
        console.log('입력값:', `"${input}"`);

        if (!sessionId || !activePythonProcesses.has(sessionId)) {
            console.log('❌ 유효하지 않은 세션 ID');
            return res.json({
                success: false,
                error: '유효하지 않은 세션입니다.'
            });
        }

        const processInfo = activePythonProcesses.get(sessionId);
        console.log('✅ 프로세스 찾음, 입력값 전달 중...');

        // 🔥 중요: 응답 객체 설정 후 입력값 전달
        processInfo.resumeRes = res;
        processInfo.process.stdin.write(input + '\n');

        console.log('📤 입력값 전달 완료, Python 프로세스 재개 대기 중...');

    } catch (error) {
        console.error('❌ Python 실행 재개 오류:', error);
        res.json({
            success: false,
            error: `재개 오류: ${error.message}`
        });
    }
});

// Python 프로세스 종료
router.post('/api/stop-python', async (req, res) => {
    const { sessionId } = req.body;

    if (sessionId && activePythonProcesses.has(sessionId)) {
        const processInfo = activePythonProcesses.get(sessionId);
        processInfo.process.kill();
        activePythonProcesses.delete(sessionId);

        res.json({ success: true, message: '프로세스가 종료되었습니다.' });
    } else {
        res.json({ success: false, error: '종료할 프로세스를 찾을 수 없습니다.' });
    }
});

/**
 * 🔥 최종 완성: 대화형 Python 프로세스
 */
async function startInteractivePython(code, sessionId, res) {
    console.log('--- 대화형 Python 프로세스 시작 ---');

    // 임시 파일 생성
    const timestamp = Date.now();
    const fileName = `temp_interactive_${sessionId}_${timestamp}.py`;
    const filePath = path.join(__dirname, '..', fileName);

    // 🔥 최종 래퍼 코드
    const wrappedCode = createFinalInteractiveWrapper(code);

    try {
        // 파이썬 코드를 임시 파일에 저장
        fs.writeFileSync(filePath, wrappedCode, 'utf8');
        console.log('📝 임시 파일 저장:', filePath);

        // Python 프로세스 생성
        const pythonProcess = spawn('python3', ['-u', fileName], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        // 프로세스 정보 저장
        const processInfo = {
            process: pythonProcess,
            filePath: filePath,
            sessionId: sessionId,
            outputBuffer: '',
            errorBuffer: '',
            startTime: Date.now(),
            initialRes: res,
            resumeRes: null,
            waitingForInput: false,
            hasInitialResponse: false
        };

        activePythonProcesses.set(sessionId, processInfo);
        console.log('✅ 프로세스 정보 저장 완료');

        // 🔥 stdout 처리 - 완전히 새로운 로직
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('📤 Python stdout:', `"${output}"`);

            processInfo.outputBuffer += output;

            // 🔥 입력 대기 신호 감지
            if (output.includes('WAIT_FOR_INPUT')) {
                console.log('⏳ 입력 대기 신호 감지됨');
                processInfo.waitingForInput = true;

                // 프롬프트 추출
                const promptMatch = output.match(/PROMPT:(.+)/);
                const prompt = promptMatch ? promptMatch[1].trim() : '';

                // 깨끗한 출력 생성 (신호 제거)
                let cleanOutput = processInfo.outputBuffer
                    .replace(/WAIT_FOR_INPUT[\s\S]*$/, '')
                    .replace(/PROMPT:.*\n/g, '');

                // 🔥 프롬프트가 있다면 출력 버퍼의 끝에서 제거 (프론트엔드에서 input과 함께 인라인으로 표시하기 위함)
                if (prompt && cleanOutput.endsWith(prompt)) {
                    cleanOutput = cleanOutput.slice(0, -prompt.length);
                }

                cleanOutput = cleanOutput.trim();

                // 응답 전송
                const responseTarget = processInfo.resumeRes || processInfo.initialRes;
                if (responseTarget) {
                    console.log('📤 입력 요청 응답 전송:', { prompt, output: cleanOutput });
                    responseTarget.json({
                        success: true,
                        needsInput: true,
                        prompt: prompt,
                        sessionId: sessionId,
                        output: cleanOutput
                    });

                    if (processInfo.resumeRes) {
                        processInfo.resumeRes = null;
                    } else {
                        processInfo.initialRes = null;
                        processInfo.hasInitialResponse = true;
                    }
                }
            }
            // 🔥 실행 완료 신호 감지
            else if (output.includes('EXECUTION_FINISHED')) {
                console.log('🏁 실행 완료 신호 감지됨');

                // 깨끗한 최종 출력 생성
                const finalOutput = processInfo.outputBuffer
                    .replace(/WAIT_FOR_INPUT[\s\S]*?(?=\n|$)/g, '')
                    .replace(/PROMPT:.*\n/g, '')
                    .replace(/EXECUTION_FINISHED[\s\S]*$/, '')
                    .trim();

                // 최종 응답 전송
                const responseTarget = processInfo.resumeRes || processInfo.initialRes;
                if (responseTarget) {
                    console.log('📤 최종 완료 응답 전송:', { output: finalOutput });
                    responseTarget.json({
                        success: true,
                        needsInput: false,
                        output: finalOutput,
                        error: processInfo.errorBuffer.trim() || null,
                        sessionId: sessionId
                    });

                    if (processInfo.resumeRes) {
                        processInfo.resumeRes = null;
                    } else if (!processInfo.hasInitialResponse) {
                        processInfo.initialRes = null;
                    }
                }

                // 프로세스 종료
                setTimeout(() => {
                    if (activePythonProcesses.has(sessionId)) {
                        pythonProcess.kill('SIGTERM');
                    }
                }, 100);
            }
        });

        // stderr 처리
        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.log('❌ Python stderr:', error);
            processInfo.errorBuffer += error;
        });

        // 프로세스 종료 처리
        pythonProcess.on('close', (code) => {
            console.log(`🏁 Python 프로세스 종료 (코드: ${code})`);

            // 임시 파일 삭제
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('🗑️ 임시 파일 삭제 완료');
                }
            } catch (deleteError) {
                console.error('❌ 임시 파일 삭제 실패:', deleteError);
            }

            // 미처리 응답이 있다면 전송
            const responseTarget = processInfo.resumeRes || processInfo.initialRes;
            if (responseTarget) {
                console.log('📤 프로세스 종료 시 최종 응답 전송');

                const finalOutput = processInfo.outputBuffer
                    .replace(/WAIT_FOR_INPUT[\s\S]*?(?=\n|$)/g, '')
                    .replace(/PROMPT:.*\n/g, '')
                    .replace(/EXECUTION_FINISHED[\s\S]*$/, '')
                    .trim();

                responseTarget.json({
                    success: code === 0,
                    needsInput: false,
                    output: finalOutput,
                    error: processInfo.errorBuffer.trim() || null,
                    sessionId: sessionId
                });
            }

            // 프로세스 정보 제거
            activePythonProcesses.delete(sessionId);
            console.log('🧹 프로세스 정보 정리 완료');
        });

        // 프로세스 오류 처리
        pythonProcess.on('error', (error) => {
            console.error('❌ Python 프로세스 오류:', error);

            // 임시 파일 삭제
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (deleteError) {
                console.error('❌ 임시 파일 삭제 실패:', deleteError);
            }

            const responseTarget = processInfo.resumeRes || processInfo.initialRes;
            if (responseTarget) {
                responseTarget.json({
                    success: false,
                    error: `프로세스 오류: ${error.message}`,
                    sessionId: sessionId
                });
            }

            activePythonProcesses.delete(sessionId);
        });

        // 타임아웃 설정 (60초)
        setTimeout(() => {
            if (activePythonProcesses.has(sessionId)) {
                console.log('⏰ 대화형 Python 프로세스 타임아웃');
                pythonProcess.kill('SIGTERM');
            }
        }, 60000);

    } catch (error) {
        console.error('❌ 대화형 Python 시작 오류:', error);

        // 임시 파일 정리
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (deleteError) {
            console.error('❌ 임시 파일 삭제 실패:', deleteError);
        }

        res.json({
            success: false,
            error: `시작 오류: ${error.message}`,
            sessionId: sessionId
        });
    }
}

/**
 * 🔥 최종 완성: 프롬프트 중복 해결된 래퍼 코드
 */
function createFinalInteractiveWrapper(originalCode) {
    return `
import sys
import builtins

# 출력 즉시 표시를 위한 설정
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# 원본 input 함수 백업
original_input = builtins.input

def interactive_input(prompt=''):
    """프롬프트 중복 해결된 대화형 input 함수"""
    
    # 🔥 수정: 프롬프트 처리 방식 변경
    if prompt:
        # 사용자가 보는 프롬프트는 한 번만 출력
        print(prompt, end='', flush=True)
        # 서버 신호용 프롬프트는 별도 전송
        print(f"\\nPROMPT:{prompt}", flush=True)
    
    # 입력 대기 신호 출력
    print("WAIT_FOR_INPUT", flush=True)
    
    # 실제 입력 대기
    try:
        user_input = sys.stdin.readline()
        if user_input:
            return user_input.strip()
        return ""
    except (KeyboardInterrupt, EOFError):
        return ""
    except Exception as e:
        print(f"입력 오류: {e}", file=sys.stderr, flush=True)
        return ""

# input 함수 교체
builtins.input = interactive_input

# 🔥 사용자 코드 실행
try:
${originalCode.split('\n').map(line => '    ' + line).join('\n')}
    
except KeyboardInterrupt:
    print("\\n프로그램이 중단되었습니다.", flush=True)
except Exception as e:
    import traceback
    print(f"실행 오류: {e}", file=sys.stderr, flush=True)
    traceback.print_exc()
finally:
    # input 함수 복원
    builtins.input = original_input
    print("EXECUTION_FINISHED", flush=True)
`;
}

/**
 * 일반 Python 실행 (input() 없는 경우)
 */
function executeNormalPython(code, req, res) {
    console.log('--- 일반 Python 실행 ---');

    const timestamp = Date.now();
    const userId = req.session?.userID || 'anonymous';
    const fileName = `temp_${userId}_${timestamp}.py`;
    const filePath = path.join(__dirname, '..', fileName);

    try {
        fs.writeFileSync(filePath, code, 'utf8');
        console.log('📝 일반 코드 파일 저장 완료');

        const execOptions = {
            timeout: 3000,
            maxBuffer: 1024 * 1024,
            cwd: path.join(__dirname, '..')
        };

        exec(`python3 ${fileName}`, execOptions, (error, stdout, stderr) => {
            console.log('✅ 일반 Python 실행 완료');

            // 임시 파일 삭제
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('🗑️ 일반 실행 임시 파일 삭제 완료');
                }
            } catch (deleteError) {
                console.error('❌ 일반 실행 임시 파일 삭제 실패:', deleteError);
            }

            if (error) {
                console.error('❌ 일반 Python 실행 오류:', error);
                let errorMessage = '';

                if (error.code === 'ENOENT') {
                    errorMessage = 'Python이 설치되지 않았거나 경로를 찾을 수 없습니다.';
                } else if (error.signal === 'SIGTERM') {
                    errorMessage = '코드 실행 시간이 초과되었습니다. (3초 제한)';
                } else if (stderr && stderr.trim()) {
                    errorMessage = stderr.trim();
                } else {
                    errorMessage = error.message || '알 수 없는 실행 오류가 발생했습니다.';
                }

                return res.json({
                    success: false,
                    output: '',
                    error: errorMessage
                });
            }

            if (stderr && stderr.trim()) {
                console.log('⚠️ 일반 Python stderr:', stderr);
                return res.json({
                    success: true,
                    output: stdout || '(출력 없음)',
                    warning: stderr.trim()
                });
            }

            console.log('📤 일반 Python stdout:', stdout);
            const finalOutput = stdout && stdout.trim() ? stdout.trim() : '(출력 없음)';

            res.json({
                success: true,
                output: finalOutput,
                error: null
            });
        });

    } catch (error) {
        console.error('❌ 일반 Python 실행 오류:', error);
        res.json({
            success: false,
            output: '',
            error: `서버 오류: ${error.message}`
        });
    }
}

// 기타 API들...
router.get('/api/get-code-template', async (req, res) => {
    try {
        const { examName, problemNumber } = req.query;

        if (!examName || !problemNumber) {
            return res.status(400).json({
                success: false,
                error: '시험명과 문제 번호가 필요합니다.'
            });
        }

        const defaultTemplate = `# ${examName} - 문제 ${problemNumber}`;

        res.json({
            success: true,
            template: defaultTemplate,
            examName: examName,
            problemNumber: problemNumber
        });

    } catch (error) {
        console.error('코드 템플릿 API 오류:', error);
        res.status(500).json({
            success: false,
            error: '코드 템플릿을 가져오는 중 오류가 발생했습니다.',
            message: error.message
        });
    }
});

router.get('/api/check-python-env', (req, res) => {
    exec('python3 --version', (error, stdout, stderr) => {
        if (error) {
            return res.json({
                success: false,
                available: false,
                error: 'Python3가 설치되지 않았습니다.',
                message: error.message
            });
        }

        const version = stdout.trim();
        res.json({
            success: true,
            available: true,
            version: version,
            message: 'Python 실행 환경이 준비되었습니다.'
        });
    });
});

router.get('/api/status', (req, res) => {
    res.json({
        message: 'Python 라우터가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        activeSessions: activePythonProcesses.size,
        availableEndpoints: [
            '/python/api/get-python-data',
            '/python/api/run-python-interactive',
            '/python/api/resume-python',
            '/python/api/stop-python',
            '/python/api/get-code-template',
            '/python/api/check-python-env',
            '/python/api/status'
        ]
    });
});

// 서버 종료 시 정리
process.on('SIGINT', cleanupProcesses);
process.on('SIGTERM', cleanupProcesses);

function cleanupProcesses() {
    console.log('🧹 서버 종료 중... Python 프로세스 정리');

    for (const [sessionId, processInfo] of activePythonProcesses) {
        try {
            processInfo.process.kill('SIGTERM');
            if (fs.existsSync(processInfo.filePath)) {
                fs.unlinkSync(processInfo.filePath);
            }
        } catch (error) {
            console.error(`❌ 프로세스 정리 오류 (${sessionId}):`, error);
        }
    }

    activePythonProcesses.clear();
    console.log('✅ 모든 Python 프로세스 정리 완료');
}

module.exports = router;