const { google } = require('googleapis');
const config = require('../config');

let sheets;
let authClient; // Service Account 인증용

async function initGoogleSheets() {
    // 읽기 전용: API Key 사용
    sheets = google.sheets({ version: 'v4', auth: config.GOOGLE_API.KEY });

    // 쓰기: Service Account 사용
    try {
        // Service Account JSON 키 파일 경로 또는 환경변수
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            authClient = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            console.log('✅ Google Sheets Service Account 인증 성공');
        } else {
            console.warn('⚠️ GOOGLE_SERVICE_ACCOUNT_KEY not found. Write operations will fail.');
        }
    } catch (error) {
        console.error('❌ Service Account 인증 실패:', error.message);
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('Google Sheets API 초기화 성공');
    }
}

async function getSheetData(range, customSpreadsheetId) {
    if (!sheets) {
        await initGoogleSheets();
    }

    try {
        const requestParams = {
            spreadsheetId: customSpreadsheetId || config.GOOGLE_API.SPREADSHEET_ID,
            range: range,
        };

        const response = await sheets.spreadsheets.values.get(requestParams);

        if (!response || !response.data) {
            console.error('API 응답이 없거나 올바르지 않음:', response);
            return [];
        }

        const rows = response.data.values || [];

        // 🔥 S3 URL 자동 변환 로직 (Hardcoded AWS -> Configured Asset URL)
        // 구글 시트에 "amazonaws.com" 주소가 박혀 있어도, 설정된 ASSET_URL로 실시간 교체하여 반환함
        config.S3.ASSET_URL = config.S3.ASSET_URL.replace(/\/$/, ''); // Trailing slash 제거 안전장치

        const legacyS3Url = 'https://kr.object.ncloudstorage.com/educodingnplaycontents';
        const edgeUrl = 'https://onag54aw13447.edge.naverncp.com';

        return rows.map(row => {
            return row.map(cell => {
                if (typeof cell === 'string') {
                    // Legacy NCP URL 변환
                    if (cell.includes(legacyS3Url)) {
                        return cell.split(legacyS3Url).join(config.S3.ASSET_URL);
                    }
                    // 🔥 Edge URL 경로 수정: /COS/ -> /cos/, /ENT/ -> /ent/ 등
                    if (cell.includes(edgeUrl)) {
                        return cell.replace(/\/([A-Z]+)\//g, (match, folder) => {
                            return '/' + folder.toLowerCase() + '/';
                        });
                    }
                }
                return cell;
            });
        });
    } catch (error) {
        console.error(`스프레드시트 데이터 로드 오류 (${range}):`, error.message);
        throw error;
    }
}

/**
 * 구글 시트에 데이터 추가 (Append)
 * @param {string} range - 시트 범위 (예: 'pong!!A:F')
 * @param {Array<Array>} values - 추가할 데이터 (2차원 배열)
 * @param {string} customSpreadsheetId - 선택적 스프레드시트 ID
 * @returns {Promise<Object>} - 추가 결과
 */
async function appendSheetData(range, values, customSpreadsheetId) {
    if (!sheets || !authClient) {
        await initGoogleSheets();
    }

    if (!authClient) {
        throw new Error('Google Service Account 인증이 필요합니다. GOOGLE_SERVICE_ACCOUNT_KEY 환경변수를 설정하세요.');
    }

    try {
        // Service Account로 인증된 Sheets 클라이언트 생성
        const auth = await authClient.getClient();
        const sheetsWithAuth = google.sheets({ version: 'v4', auth });

        const requestParams = {
            spreadsheetId: customSpreadsheetId || config.GOOGLE_API.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW', // RAW = 수식 해석 안함, USER_ENTERED = 수식 해석
            insertDataOption: 'INSERT_ROWS', // 새 행으로 추가
            resource: {
                values: values
            }
        };

        const response = await sheetsWithAuth.spreadsheets.values.append(requestParams);

        console.log('✅ Google Sheets 데이터 추가 성공:', response.data);

        return {
            success: true,
            updatedRange: response.data.updates.updatedRange,
            updatedRows: response.data.updates.updatedRows
        };

    } catch (error) {
        console.error(`스프레드시트 데이터 추가 오류 (${range}):`, error.message);
        console.error('Full error:', error);
        throw error;
    }
}

module.exports = { getSheetData, initGoogleSheets, appendSheetData };
