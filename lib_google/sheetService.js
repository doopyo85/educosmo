const { google } = require('googleapis');
const config = require('../config');

let sheets;

async function initGoogleSheets() {
    sheets = google.sheets({ version: 'v4', auth: config.GOOGLE_API.KEY });
    if (process.env.NODE_ENV === 'development') {
        console.log('Google Sheets API 초기화 성공');
    }
}

async function getSheetData(range) {
    if (!sheets) {
        await initGoogleSheets();
    }

    try {
        const requestParams = {
            spreadsheetId: config.GOOGLE_API.SPREADSHEET_ID,
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

module.exports = { getSheetData, initGoogleSheets };
