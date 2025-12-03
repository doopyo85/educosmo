/**
 * 🎯 플랫폼 어댑터 베이스 클래스
 * 모든 플랫폼 어댑터가 상속받아야 하는 추상 클래스
 */
class BaseAdapter {
    /**
     * 프로젝트 데이터 검증
     * @param {Object} projectData - 플랫폼별 프로젝트 데이터
     * @throws {Error} 검증 실패 시
     */
    async validate(projectData) {
        throw new Error('validate() 메서드를 구현해야 합니다.');
    }

    /**
     * 저장을 위한 데이터 전처리
     * @param {Object} projectData - 원본 프로젝트 데이터
     * @returns {Buffer} 저장할 데이터
     */
    async process(projectData) {
        throw new Error('process() 메서드를 구현해야 합니다.');
    }

    /**
     * 프로젝트 분석 (복잡도, 블록 수 등)
     * @param {Object} projectData - 프로젝트 데이터
     * @returns {Object} 분석 결과
     */
    async analyze(projectData) {
        throw new Error('analyze() 메서드를 구현해야 합니다.');
    }

    /**
     * S3 저장 시 Content-Type
     * @returns {string}
     */
    getContentType() {
        return 'application/json';
    }

    /**
     * 불러오기 시 데이터 후처리
     * @param {Buffer|string} projectData - S3에서 가져온 데이터
     * @returns {Object} 처리된 프로젝트 데이터
     */
    async postProcess(projectData) {
        // 기본: JSON 파싱
        if (Buffer.isBuffer(projectData)) {
            return JSON.parse(projectData.toString('utf-8'));
        }
        return typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
    }

    /**
     * 파일 확장자 반환
     * @returns {string}
     */
    getExtension() {
        throw new Error('getExtension() 메서드를 구현해야 합니다.');
    }
}

module.exports = BaseAdapter;
