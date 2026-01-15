const fs = require('fs');
const path = require('path');

const rawData = `scratch	CPS	1-1. 동네 산책 길잡이	basic	CPS_1-1	이벤트	스프라이트 움직이기	1	1	TRUE
scratch	CPS	1-2. 미래의 애니메이터	basic	CPS_1-2	순차적 실행	배경과 스프라이트 표현하기	1	1	TRUE
scratch	CPS	1-3. 내 소중한 보물을 숨겨 줘	basic	CPS_1-3	X, Y 좌표	애니메이션 표현하기	1	1	TRUE
scratch	CPS	1-4. 백발 발레리나의 마지막 무대	basic	CPS_1-4	소리 활용	소리재생하기	1	1	TRUE
scratch	CPS	2-1. 무사히 착륙하라!	basic	CPS_2-1	감지	반복 실행하기	2	1	TRUE
scratch	CPS	2-2. 불꽃이 팡! 팡! 팡!	basic	CPS_2-2	반복	조건 설정하기	2	1	TRUE
scratch	CPS	2-3. 엄마! TV 봐도 돼요	basic	CPS_2-3	신호 보내기	신호 주고받기	2	1	TRUE
scratch	CPS	2-4. 어째 으스스한 기분이 들어	basic	CPS_2-4	조건	펜 사용하기	2	1	TRUE
scratch	CPS	3-1. 화산 폭발 일보 직전!	basic	CPS_3-1	레이어	변수 만들기	3	1	TRUE
scratch	CPS	3-2. 색이 변하는 나뭇잎	basic	CPS_3-2	변수	무작위로 선택하기	3	1	TRUE
scratch	CPS	3-3. 꼬마 해녀의 삶	basic	CPS_3-3	함수	추가 블록 정의하기	3	1	TRUE
scratch	CPS	3-4. 음악에 몸을 맡겨 봐	basic	CPS_3-4	무작위 수	시간 측정하기	3	1	TRUE
scratch	CPS	4-1. 피아노 연주(feat. 흥얼흥얼)	basic	CPS_4-1	연주기능	연주기능 활용하기	4	1	TRUE
scratch	CPS	4-2. 내 기분이 궁금해	basic	CPS_4-2	복제	복제하기	4	1	TRUE
scratch	CPS	4-3. 어! 어! 어! 어!	basic	CPS_4-3	픽셀	픽셀 탐색과 색 설정	4	1	TRUE
scratch	CPS	4-4. 퀴즈 쇼! 정답을 맞혀라	basic	CPS_4-4	이진수	이진수 개념 이용하기	4	1	TRUE
scratch	CPS	5-1. 꽤 멋진 별명	basic	CPS_5-1	리스트	리스트 만들기	5	1	TRUE
scratch	CPS	5-2. 삐-빅! 날씨 정보 입력 완료!	basic	CPS_5-2	리스트	이야기 만들기	5	1	TRUE
scratch	CPS	5-3. 목표는 세계 일주	basic	CPS_5-3	추상화	픽셀 색 켜고 끄기	5	1	TRUE
scratch	CPS	5-4. 클릭만 하면 돼	basic	CPS_5-4	추상화	아이콘과 문자 나타내기	5	1	TRUE
scratch	CPS	6-1. 여기는 식물 연구소입니다	basic	CPS_6-1	연산	수와 연산	6	1	TRUE
scratch	CPS	6-2. 알뜰살뜰 경제 대장	basic	CPS_6-2	문제 분해	과학 실험	6	1	TRUE
scratch	CPS	6-3. 째깍째깍 돌아라	basic	CPS_6-3	결과 예측	생활 속 코딩	6	1	TRUE
entry	CPE	CPE 1-1. 토끼와 거북이의 재대결	basic	CPE_1-1	오브젝트, 좌표	말하기, 이동하기, 기다리기	1	1	TRUE
entry	CPE	CPE 1-2. 은혜갚은 개미	basic	CPE_1-2	순차, 횟수 반복	모터 회전, 0번 반복	1	1	TRUE
entry	CPE	CPE 1-3. 비겁한 박쥐	basic	CPE_1-3	계속 반복	계속 반복, 모양 바꾸기, 움직이기, 튕기기	1	1	TRUE
entry	CPE	CPE 1-4. 까마귀와 물병	basic	CPE_1-4	이벤트, 장면	"키를 눌렀을 때(장면 시작 / 오브젝트 클릭),
모양 숨기기/보이기,
위치로 이동하기, 다음 장면, 소리 재생"	1	1	TRUE
entry	CPE	CPE 2-1. 사자와 생쥐	basic	CPE_2-1	선택(만일 참이라면)	만일 참이라면, 방향 회전, 초시계, ~에 닿았는가, 합치기	2	1	TRUE
entry	CPE	CPE 2-2. 현대판 양치기 소년과 늑대	basic	CPE_2-2	변수, 난수	바라보기, 무작위수, 비교연산	2	1	TRUE
entry	CPE	CPE 2-3. 개구리의 최후	basic	CPE_2-3	조건 반복	참이 될 때까지 반복하기, 논리연산, 글상자	2	1	TRUE
entry	CPE	CPE 2-4. 고양이 목에 방울 달기	basic	CPE_2-4	신호, 산술연산	신호보내기/받기, 산술연산, 모든 코드 멈추기	2	1	TRUE
entry	CPE	CPE 3-1. 만 나이 계산기	basic	CPE_3-1	입력, 메모(주석)	묻고 대답 기다리기(입력), 메모, 현재 날짜 구하기	3	1	TRUE
entry	CPE	CPE 3-2. 평면도형과 각도	basic	CPE_3-2	함수	함수	3	1	TRUE
entry	CPE	CPE 3-3. 간접흡연은 싫어요	basic	CPE_3-3	API, 중첩 반복문	현재 시각 구하기, 확장 블록	3	1	TRUE
entry	CPE	CPE 3-4. 도형의 배열에서 규칙 찾기	basic	CPE_3-4	함수(매개변수)	함수(매개변수), 도장찍기	3	1	TRUE
entry	CPE	CPE 4-1. 내 손으로 만드는 라인트레이서	basic	CPE_4-1			4	1	FALSE
entry	CPE	CPE 4-2. 발표자 추첨 프로그램	basic	CPE_4-2			4	1	FALSE
entry	CPE	CPE 4-3. 레트로 게임 만들기(1)	basic	CPE_4-3			4	1	FALSE
entry	CPE	CPE 4-4. 레트로 게임 만들기(2)	basic	CPE_4-4			4	1	FALSE
entry	CPE	CPE 5-1. 거북목 탈출 게임	basic	CPE_5-1			5	1	FALSE
entry	CPE	CPE 5-2. 국어퀴즈	basic	CPE_5-2			5	1	FALSE
entry	CPE	CPE 5-3. 소방구역지킴이(스크래치)	basic	CPE_5-3			5	1	FALSE
entry	CPE	CPE 5-4. 호러 메이즈	basic	CPE_5-4			5	1	FALSE
entry	CPE	CPE 6-1. 힐링체험! 돌을키워라!	basic	CPE_6-1			6	1	FALSE
entry	CPE	CPE 6-2. 캐치보이스피싱	basic	CPE_6-2			6	1	FALSE
entry	CPE	CPE 6-3. 키오스크 어렵지않아요	basic	CPE_6-3			6	1	FALSE
entry	CPE	CPE 6-4. 스마트 AI 냉장고	basic	CPE_6-4			6	1	FALSE
entry	CPA	CPA 1-1. 음성으로 드론을 조정한다고?	basic	CPA_1-1	감각과 인식 : 음성인식	음성으로 드론을 조종한다고?	1	1	TRUE
entry	CPA	CPA 1-2. 나를 대신해서 책을 읽어주는 오디오북	basic	CPA_1-2	언어와 소통 : 읽어주기	나를 대신해서 책을 읽어주는 오디오북	1	1	TRUE
entry	CPA	CPA 1-3.번역을 도와줘!	basic	CPA_1-3	언어와 소통 : 번역	번역을 도와줘!	1	1	TRUE
entry	CPA	CPA 1-4. 인공지능 코디 스타일봇	basic	CPA_1-4	감각과 인식 : 비디오감지	인공지능 코디, 스타일봇	1	1	TRUE
entry	CPA	CPA 2-1. 나 혼자 게임한다(AI와 가위바위보)	basic	CPA_2-1	지도학습 : 이미지 분류	나 혼자 게임한다(AI와 가위 바위 보!)	2	1	TRUE
entry	CPA	CPA 2-2. 나만의 인공지능DJ	basic	CPA_2-2	지도학습 : 음성 분류	나만의 인공지능 DJ	2	1	TRUE
entry	CPA	CPA 2-3. 꿈꿔왔던 나의 집, 스마트홈	basic	CPA_2-3	지도학습 : 텍스트 분류	스마트홈	2	1	TRUE
entry	CPA	CPA 2-4. 졸음운전은 안돼요!	basic	CPA_2-4	지도학습 : 이미지 분류	졸음 운전은 안돼요!	2	1	TRUE
entry	CPA	CPA 3-1. 요리 재료 양 예측하기	basic	CPA_3-1	지도학습 : 예측 : 숫자 / 선형회귀 알고리즘	요리 재료 양 예측하기	3	1	TRUE
entry	CPA	CPA 3-2. 음료 급식을 추천해줘	basic	CPA_3-2	지도학습 : 분류 : 숫자 / KNN알고리즘(입력 값이 어디에 가까운지)	음료 급식을 추천해줘	3	1	TRUE
entry	CPA	CPA 3-3. 해커톤 대회 장소 정하기	basic	CPA_3-3	비지도학습 : 군집 : 숫자	해커톤 대회 장소 정하기	3	1	TRUE
entry	CPA	CPA 3-4. 꽃의 품종을 구분하는 인공지능 앱	basic	CPA_3-4	지도학습 : 분류 : 숫자 / KNN알고리즘(입력 값이 어디에 가까운지)	꽃의 종류를 판별하는 인공지능 앱	3	1	TRUE
appinventor	CTR앱인벤터	1-1. 동물카드어플만들기: 변수	basic	AIA_1-1	변수	자료 저장/갱신하기	1	1	TRUE
appinventor	CTR앱인벤터	1-2. 동물카드어플만들기: 리스트	basic	AIA_1-2	리스트	인덱싱을 통한 자료 호출하기	1	1	TRUE
appinventor	CTR앱인벤터	1-3. 동물카드어플만들기: 함수	basic	AIA_1-3	함수	번역기 컴포넌트 활용하기	1	1	TRUE
appinventor	CTR앱인벤터	1-4. 동물카드어플만들기: 레이아웃	basic	AIA_1-4	레이아웃	멀티스크린 레이아웃 기획	1	1	TRUE
appinventor	CTR앱인벤터	2-1. 플라잉버드: 캔버스/ 이미지스프라이트,	basic	AIA_2-1	캔버스/ 이미지스프라이트	인덱싱을 통한 자료 호출하기	2	1	TRUE
appinventor	CTR앱인벤터	2-2. 플라잉버드: 리스트, 반복	basic	AIA_2-2	타이머	애니메이션, 이벤트 충돌 구현하기	2	1	TRUE
appinventor	CTR앱인벤터	2-3. 플라잉버드: 조건문, 변수	basic	AIA_2-3	지역변수 / 전역변수	함수와 반복문을 활용하여 코드 리팩토링(다시쓰기)	2	1	TRUE
appinventor	CTR앱인벤터	2-4. 플라잉버드: 함수	basic	AIA_2-4	TinyDB	로컬 DB를 활용하여 최고점수 기록하기	2	1	TRUE
appinventor	CTR앱인벤터	3-1. 주정차단속어플: 카메라/ 목록, 변수	basic	AIA_3-1	이미지	회원가입/ 로그인 기능 구현하기	3	1	TRUE
appinventor	CTR앱인벤터	3-2. 주정차단속어플: 조건문, 반복	basic	AIA_3-2	DB	로컬 DB를 목록으로 관리, 호출하기	3	1	TRUE
appinventor	CTR앱인벤터	3-3. 주정차단속어플: 함수	basic	AIA_3-3	로그인	캔버스/이미지스프라이트로 그림판기능 구현하기	3	1	TRUE
appinventor	CTR앱인벤터	3-4. 주정차단속어플: 레이아웃	basic	AIA_3-4	UI	멀티스크린에서 초기값 전달하고 받기	3	1	TRUE
appinventor	CTR앱인벤터	4-1. 챗봇어플: 구글AI/ 리스트, 변수	basic	AIA_4-1	WEB(HTML)	웹뷰어를 활용하여 웹 가져오기	4	1	TRUE
appinventor	CTR앱인벤터	4-2. 챗봇어플: 조건문, 반복	basic	AIA_4-2	데이터파싱(XML, JSON)	실시간 뉴스, 날씨 데이터 가져오기 연습	4	1	TRUE
appinventor	CTR앱인벤터	4-3. 챗봇어플: 함수	basic	AIA_4-3	공공데이터 API 활용하기	우리학교 급식어플 만들기	4	1	TRUE
appinventor	CTR앱인벤터	4-4. 챗봇어플: 레이아웃	basic	AIA_4-4	활용 어플 만들기	배운 내용을 활용하여 자유 어플 만들기	4	1	TRUE
appinventor	CTR앱인벤터	5-1. 틱택톡: 캔버스, 이미지스프라이트, 변수	basic	AIA_5-1	REST API	구글 파이어베이스를 활용한 인증, 실시간DB 구조화	5	1	TRUE
appinventor	CTR앱인벤터	5-2. 틱택톡: 리스트, 반복	basic	AIA_5-2	실시간 데이터베이스	로그인 기능 구현하기	5	1	TRUE
appinventor	CTR앱인벤터	5-3. 틱택톡: 조건문	basic	AIA_5-3	데이터베이스 구조화	실시간 채팅어플 만들기	5	1	TRUE
appinventor	CTR앱인벤터	5-4. 틱택톡: 함수	basic	AIA_5-4	활용 어플 만들기	배운 내용을 활용하여 자유 어플 만들기	5	1	TRUE
appinventor	CTR앱인벤터	6-1. 날씨어플: API, 변수	basic	AIA_6-1	마인드맵	아이디어 발굴하기	6	1	TRUE
appinventor	CTR앱인벤터	6-2. 날씨어플: 리스트, 반복	basic	AIA_6-2	어플 기획하기	기획하고 구현해보기	6	1	TRUE
appinventor	CTR앱인벤터	6-3. 날씨어플: 조건문	basic	AIA_6-3	활용 어플 만들기	배운 내용을 활용하여 자유 어플 만들기	6	1	TRUE
appinventor	CTR앱인벤터	6-4. 날씨어플: 함수	basic	AIA_6-4	활용 어플 만들기	배운 내용을 활용하여 자유 어플 만들기	6	1	TRUE
python	CTR 파이썬 1호	1. 변수, 입출력	basic	PY_1-1	기본 함수	파이썬 기본 입출력함수	1	1	TRUE
python	CTR 파이썬 1호	2. 기본자료형	basic	PY_1-2	변수와 자료형	변수, 자료형, 연산	1	1	TRUE
python	CTR 파이썬 1호	3. list, tuple	basic	PY_1-3	리스트와 튜플	리스트, 튜플 메서드, 인덱싱 슬라이싱	1	1	TRUE
python	CTR 파이썬 1호	4. dic, set, bool	basic	PY_1-4	딕셔너리, 집합, 불	keys, items, set	1	1	TRUE
python	CTR 파이썬 1호	5. 마무리테스트	basic	PY_1-5			1	1	FALSE
python	CTR 파이썬 2호	1. 조건문(if, else, elif)	basic	PY_2-1	조건문	if / elif / else	2	1	TRUE
python	CTR 파이썬 2호	2. 반복문(while, for)	basic	PY_2-2	반복문	while / for	2	1	TRUE
python	CTR 파이썬 2호	3. 함수(function)	basic	PY_2-3	함수	def	2	1	TRUE
python	CTR 파이썬 2호	4. 파일 읽고 쓰기	basic	PY_2-4	파일입출력	file w d r	2	1	TRUE
python	CTR 파이썬 2호	5. 마무리테스트	basic	PY_2-5			2	1	FALSE
python	CTR 파이썬 3호	1. 클래스(class)	basic	PY_3-1	클래스	class / __init__	3	1	TRUE
python	CTR 파이썬 3호	2. 모듈(module)	basic	PY_3-2	모듈	import module	3	1	TRUE
python	CTR 파이썬 3호	3. 예외처리(exception)	basic	PY_3-3	예외처리	except / error	3	1	TRUE
python	CTR 파이썬 3호	4. 라이브러리	basic	PY_3-4	내장함수/라이브러리	Numpy,	3	1	TRUE
python	CTR 파이썬 3호	5. 마무리테스트	basic	PY_3-5			3	1	FALSE
python	CTR 파이썬 프로젝트	1. 포켓몬배틀	basic				4	1	FALSE
python	CTR 파이썬 프로젝트	2. 단어맞추기: 행맨	basic				4	1	FALSE
python	CTR 파이썬 프로젝트	3. 햄버거 키오스크	basic				4	1	FALSE
python	CTR 파이썬 프로젝트	4. 음원차트 크롤링	basic				4	1	FALSE
dataanalysis	1장: 데이터분석 개요	1. 데이터 분석 개요	basic				1	1	FALSE
dataanalysis	2장: 데이터시각화	2-1. 데이터 구조와 특성	basic				2	1	FALSE
dataanalysis	2장: 데이터시각화	2-2. 데이터시각화기법	basic				2	1	FALSE
dataanalysis	2장: 데이터시각화	2-3. 기술통계와 데이터요약	basic				2	1	FALSE
dataanalysis	2장: 데이터시각화	2-4. AI도구를 활용한 EDA와 전통적방식 비교	basic				2	1	FALSE
dataanalysis	2장: 데이터시각화	2-5. 실제 데이터셋 탐색	basic				2	1	FALSE
dataanalysis	2장: 데이터시각화	2-6. 완료	basic				2	1	FALSE
dataanalysis	3장: 확률과통계	3-1. 확률분포와 통계적 개념	basic				3	1	FALSE
dataanalysis	3장: 확률과통계	3-2. 가설 검정의 이해	basic				3	1	FALSE
dataanalysis	3장: 확률과통계	3-3. 상관관계와 인과관계	basic				3	1	FALSE
dataanalysis	3장: 확률과통계	3-4. AI가 생성한 통계 분석 결과 검증	basic				3	1	FALSE
dataanalysis	3장: 확률과통계	3-5. 통계적 가설 검정수행	basic				3	1	FALSE
dataanalysis	4장: 데이터전처리	4-1. 결측치와 이상치 처리	basic				4	1	FALSE
dataanalysis	4장: 데이터전처리	4-2. 데이터변환과 정규화	basic				4	1	FALSE
dataanalysis	4장: 데이터전처리	4-3. 특성(feature)공학	basic				4	1	FALSE
dataanalysis	4장: 데이터전처리	4-4. AI도구를 활용한 자동 전처리와 한계점	basic				4	1	FALSE
dataanalysis	4장: 데이터전처리	4-5. 실제 데이터 전처리 파이프라인 구축	basic				4	1	FALSE
dataanalysis	5장: 머신러닝	5-1. 지도학습과 비지도학습	basic				5	1	FALSE
dataanalysis	5장: 머신러닝	5-2. 분류 알고리즘의 이해와 구현	basic				5	1	FALSE
dataanalysis	5장: 머신러닝	5-3. 회귀 알고리즘의 이해와 구현	basic				5	1	FALSE
dataanalysis	5장: 머신러닝	5-4. 모델 평가와 검증 방법	basic				5	1	FALSE
dataanalysis	5장: 머신러닝	5-5. 예측모델 개발 및 평가	basic				5	1	FALSE
dataanalysis	6장: 앙상블기법	6-1. 앙상블 학습과 투표 방식	basic				6	1	FALSE
dataanalysis	6장: 앙상블기법	6-2. 차원 축소와 군집화	basic				6	1	FALSE
dataanalysis	6장: 앙상블기법	6-3. 하이퍼파라미터 최적화	basic				6	1	FALSE
dataanalysis	6장: 앙상블기법	6-4. AI와 협업을 통한 모델 개선	basic				6	1	FALSE
dataanalysis	6장: 앙상블기법	6-5. 복합모델 구축 및 최적화	basic				6	1	FALSE
dataanalysis	7장: 프롬프트엔지니어링	7-1. 프롬프트엔지니어링 기법	basic				7	1	FALSE
dataanalysis	7장: 프롬프트엔지니어링	7-2. AI 생성코드 검증 및 최적화	basic				7	1	FALSE
dataanalysis	7장: 프롬프트엔지니어링	7-3. 자동화와수동 작업의 균형찾기	basic				7	1	FALSE
dataanalysis	7장: 프롬프트엔지니어링	7-4. 대규모 언어모델을 활용한 데이터분석	basic				7	1	FALSE
dataanalysis	7장: 프롬프트엔지니어링	7-5. AI보조분석 워크플로우 구축	basic				7	1	FALSE
dataanalysis	8장: 시계열데이터처리	8-1. 시계열 데이터의 특성과 전처리	basic				8	1	FALSE
dataanalysis	8장: 시계열데이터처리	8-2. 전통적 시계열모델(ARIMA, 지수평활법)	basic				8	1	FALSE
dataanalysis	8장: 시계열데이터처리	8-3. 머신러닝기반 시계열 예측	basic				8	1	FALSE
dataanalysis	8장: 시계열데이터처리	8-4. 딥러닝을 활용한 시계열 예측	basic				8	1	FALSE
dataanalysis	8장: 시계열데이터처리	8-5. 실제 시계열 데이터 예측 및 비교분석	basic				8	1	FALSE`;

const Papa = require('papaparse');

const parsed = Papa.parse(rawData, {
    delimiter: "\t",
    quoteChar: '"',
    header: false,
    skipEmptyLines: true
});

const lines = parsed.data;
const columns = [
    'platform', 'category', 'content_name', 'content_type', 'roadmap_key',
    'ct_element', 'training_point', 'difficulty_level', 'is_active', 'has_ct'
];

let sql = `-- ================================================================================
-- Fix Content Map Data (Migrate to ContentMap)
-- ================================================================================

-- Drop the temporary table created by mistake
DROP TABLE IF EXISTS content_map;

-- Make sure ContentMap exists (schema from before)
-- Note: We assume the table already exists as per the user's DESCRIBE output.
-- We will NOT create it here to avoid conflicts, but we will TRUNCATE it.

-- Clear existing data in ContentMap to avoid duplicates
TRUNCATE TABLE ContentMap;

INSERT INTO ContentMap (platform, category, content_name, content_type, difficulty_level, is_active) VALUES
`;


const values = [];
const seenKeys = new Map(); // key: "platform|content_name|content_type", value: count

// First pass to detect duplicates
for (const parts of lines) {
    if (parts.length < 1) continue;
    const safeParts = [...parts];
    while (safeParts.length < 10) safeParts.push('');

    // Unescape for processing
    const platform = String(safeParts[0] || '').trim();
    let content_name = String(safeParts[2] || '').trim();
    if (content_name.startsWith('"') && content_name.endsWith('"')) {
        content_name = content_name.substring(1, content_name.length - 1);
    }
    const content_type = String(safeParts[3] || '').trim() || 'basic';

    const key = `${platform}|${content_name}|${content_type}`;
    seenKeys.set(key, (seenKeys.get(key) || 0) + 1);
}

for (const parts of lines) {
    if (parts.length < 1) continue;

    const safeParts = [...parts];
    while (safeParts.length < 10) {
        safeParts.push('');
    }

    // Process parts similar to before but with de-duplication logic
    let [
        platform, category, content_name, content_type, roadmap_key,
        ct_element, training_point, difficulty_level, is_active, has_ct
    ] = safeParts.map(p => {
        let val = String(p || '').trim();
        // Remove surrounding quotes if they exist (CSV style)
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        return val;
    });

    // Default content_type
    const finalContentType = content_type || 'basic';

    // check for duplicates
    const key = `${platform}|${content_name}|${finalContentType}`;
    if (seenKeys.get(key) > 1) {
        // Collision detected! Append category to make it unique
        // e.g. "5. 마무리테스트" -> "5. 마무리테스트 (CTR 파이썬 1호)"
        content_name = `${content_name} (${category})`;
        console.log(`[Info] Renamed duplicate content to: ${content_name}`);
    }

    // Escape for SQL
    platform = platform.replace(/'/g, "\\'");
    category = category.replace(/'/g, "\\'");
    content_name = content_name.replace(/'/g, "\\'");
    const finalContentTypeEscaped = finalContentType.replace(/'/g, "\\'");

    const isActiveVal = (is_active === '1' || is_active.toUpperCase() === 'TRUE') ? 1 : 0;
    const diffVal = parseInt(difficulty_level) || 1;

    values.push(`('${platform}', '${category}', '${content_name}', '${finalContentTypeEscaped}', ${diffVal}, ${isActiveVal})`);
}

sql += values.join(',\n') + ';';

const outputPath = path.resolve(__dirname, '../docs/migrations/006_fix_content_map.sql');
fs.writeFileSync(outputPath, sql, 'utf-8');
console.log(`Successfully generated SQL at: ${outputPath}`);
