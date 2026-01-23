/**
 * Python Parser
 * Python 파일을 파싱하여 문제은행 형식으로 변환
 */

const hljs = require('highlight.js');

class PythonParser {
  /**
   * Python 파일 파싱
   * @param {string} pyContent - Python 원본 코드
   * @returns {object} - 파싱된 데이터
   */
  parse(pyContent) {
    try {
      // 1. Docstring 추출 ("""...""" 또는 '''...''')
      const description = this.extractDocstring(pyContent);

      // 2. 테스트 케이스 추출 (# TEST: 주석 활용)
      const testCases = this.extractTestCases(pyContent);

      // 3. 함수 정의 추출
      const functions = this.extractFunctions(pyContent);

      // 4. 메타데이터 추출 (주석에서)
      const metadata = this.extractMetadata(pyContent);

      // 5. Syntax Highlight용 HTML 생성
      const highlighted = hljs.highlight(pyContent, { language: 'python' }).value;
      const html = `<pre><code class="language-python">${highlighted}</code></pre>`;

      // 6. 난이도 추정
      const difficulty = this.estimateDifficulty(pyContent);

      return {
        description,
        testCases,
        functions,
        metadata,
        code: pyContent,
        html,
        difficulty,
        lineCount: pyContent.split('\n').length
      };
    } catch (error) {
      console.error('[PythonParser] Parse error:', error);
      throw new Error(`Python 파싱 실패: ${error.message}`);
    }
  }

  /**
   * Docstring 추출
   */
  extractDocstring(code) {
    // """ 또는 ''' 형식의 docstring 찾기
    const tripleDoubleMatch = code.match(/"""([\s\S]*?)"""/);
    if (tripleDoubleMatch) {
      return tripleDoubleMatch[1].trim();
    }

    const tripleSingleMatch = code.match(/'''([\s\S]*?)'''/);
    if (tripleSingleMatch) {
      return tripleSingleMatch[1].trim();
    }

    // 첫 번째 # 주석 찾기
    const commentMatch = code.match(/^#\s*(.+)/m);
    if (commentMatch) {
      return commentMatch[1].trim();
    }

    return '';
  }

  /**
   * 테스트 케이스 추출
   * 형식: # TEST: input -> output
   * 예: # TEST: add(1, 2) -> 3
   */
  extractTestCases(code) {
    const regex = /# TEST:\s*(.+?)\s*->\s*(.+)/g;
    const cases = [];
    let match;

    while ((match = regex.exec(code)) !== null) {
      cases.push({
        input: match[1].trim(),
        expected: match[2].trim()
      });
    }

    return cases;
  }

  /**
   * 함수 정의 추출
   */
  extractFunctions(code) {
    const regex = /def\s+(\w+)\s*\((.*?)\):/g;
    const functions = [];
    let match;

    while ((match = regex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(',').map(p => p.trim()).filter(p => p)
      });
    }

    return functions;
  }

  /**
   * 메타데이터 추출 (주석에서)
   * 형식: # META: key = value
   * 예: # META: difficulty = 3
   */
  extractMetadata(code) {
    const metadata = {
      title: '',
      difficulty: 1,
      category: 'code',
      tags: []
    };

    // # META: 형식 파싱
    const metaRegex = /# META:\s*(\w+)\s*=\s*(.+)/g;
    let match;

    while ((match = metaRegex.exec(code)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();

      if (key === 'title') {
        metadata.title = value;
      } else if (key === 'difficulty') {
        metadata.difficulty = parseInt(value) || 1;
      } else if (key === 'category') {
        metadata.category = value;
      } else if (key === 'tags') {
        metadata.tags = value.split(',').map(t => t.trim());
      }
    }

    // 함수 이름에서 제목 추정
    if (!metadata.title) {
      const functions = this.extractFunctions(code);
      if (functions.length > 0) {
        metadata.title = functions[0].name;
      }
    }

    return metadata;
  }

  /**
   * 난이도 추정
   * 코드 복잡도를 기반으로 1-5 사이의 난이도 반환
   */
  estimateDifficulty(code) {
    let score = 1;

    // 줄 수
    const lines = code.split('\n').length;
    if (lines > 50) score += 1;
    if (lines > 100) score += 1;

    // 반복문
    const loops = (code.match(/\b(for|while)\b/g) || []).length;
    if (loops > 2) score += 1;

    // 조건문
    const conditions = (code.match(/\b(if|elif)\b/g) || []).length;
    if (conditions > 3) score += 1;

    // 함수 정의
    const functions = (code.match(/\bdef\b/g) || []).length;
    if (functions > 2) score += 1;

    // 클래스 정의
    const classes = (code.match(/\bclass\b/g) || []).length;
    if (classes > 0) score += 1;

    // 최대 5로 제한
    return Math.min(score, 5);
  }

  /**
   * 문제은행 형식으로 변환
   * Google Sheets 'problems' 시트 형식에 맞춤
   */
  convertToProblemFormat(parsed) {
    return {
      exam_name: parsed.metadata.title || 'Untitled Problem',
      problem_number: '1',
      concept: parsed.description,
      test_cases: JSON.stringify(parsed.testCases),
      difficulty: parsed.difficulty.toString(),
      question_type: 'code',
      tags: parsed.metadata.tags.join(', '),
      code_template: parsed.code
    };
  }

  /**
   * Python 템플릿 생성
   */
  static createTemplate() {
    return `"""
문제 제목: 새로운 코딩 문제
설명: 여기에 문제 설명을 작성하세요.
"""

# META: difficulty = 1
# META: category = algorithm
# META: tags = python, 기초

def solution():
    """
    솔루션 함수
    """
    pass

# TEST: solution() -> expected_result

if __name__ == "__main__":
    print(solution())
`;
  }

  /**
   * Python 코드 유효성 검증
   */
  validate(pyContent) {
    if (!pyContent || typeof pyContent !== 'string') {
      throw new Error('유효한 Python 코드가 아닙니다.');
    }

    if (pyContent.length > 100000) { // 100KB 제한
      throw new Error('파일 크기가 너무 큽니다 (최대 100KB).');
    }

    // 기본적인 Python 구문 체크
    if (!pyContent.match(/def\s+\w+/) && !pyContent.match(/class\s+\w+/)) {
      console.warn('[PythonParser] 함수나 클래스 정의가 없습니다.');
    }

    return true;
  }
}

module.exports = { PythonParser };
