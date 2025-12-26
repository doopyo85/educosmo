# 문제은행 문항 파일 네이밍 규칙 정책

## 1. 개요
본 문서는 CT Connectome 프로젝트의 문제은행 문항 파일의 표준 네이밍 규칙을 정의합니다. 모든 문항 파일, 코드 템플릿, 정답 코드는 이 규칙을 따라야 합니다.

## 2. 파일명 형식
`CT-[CATEGORY]-[LEVEL]-[NUMBER][SUFFIX].[EXTENSION]`

### 2.1 요소 설명

1.  **PREFIX**: `CT`
    -   프로젝트 식별자 (Computational Thinking)

2.  **CATEGORY**: 대문자 3~4글자
    -   `VAR`: 변수, 자료형, 입출력 (Variables & Types) - CTRpython 1-2차시 해당
    -   `LIST`: 리스트, 튜플 (Lists & Tuples) - CTRpython 1-3차시 해당
    -   `DICT`: 딕셔너리, 집합 (Dictionaries & Sets) - CTRpython 1-4차시 해당
    -   (추후 확장) `COND` (조건문), `LOOP` (반복문), `FUNC` (함수) 등

3.  **LEVEL**: 난이도 및 단계
    -   `L1`: 기초 (Basic)
    -   `L2`: 응용 (Intermediate)
    -   `L3`: 심화 (Advanced)

4.  **NUMBER**: 일련번호 (3자리)
    -   `001`, `002`, `003` ...

5.  **SUFFIX**: 파일 역할 접미사 (Python 파일인 경우 필수)
    -   없음: HTML 문제 설명 파일인 경우
    -   `_e`: 예제/템플릿 코드 (Example/Template) - 학생에게 제공되는 초기 코드
    -   `_s`: 정답/해설 코드 (Solution)

6.  **EXTENSION**: 확장자
    -   `.html`: 문제 설명 (Description)
    -   `.py`: 코드 (Python)

## 3. 예시

| 파일 종류 | 기존(구) 명칭 예시 | 표준 변경 명칭 예시 |
| :--- | :--- | :--- |
| 문제 설명 (HTML) | CTRpython_1-2_p01.html | **CT-VAR-L1-001.html** |
| 문제 템플릿 (PY) | CTRpython_1-2_p01.py | **CT-VAR-L1-001_e.py** |
| 정답 코드 (PY) | CTRpython_1-2_s01.py | **CT-VAR-L1-001_s.py** |
| 리스트 문제 2번 | CTRpython_1-3_p02.html | **CT-LIST-L1-002.html** |
| 딕셔너리 문제 4번 | CTRpython_1-4_p04.html | **CT-DICT-L1-004.html** |

## 4. 적용 범위
-   python 디렉토리 내의 모든 CTRpython 관련 문제들은 이 규칙으로 이관되어야 합니다.
-   기존 `cospro` 라이브러리는 별도의 규칙(`cospro_...`)을 유지하되, 신규 제작되는 CT 문제는 위 규칙을 따릅니다.
