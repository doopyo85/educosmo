const BaseAdapter = require('./BaseAdapter');

/**
 * 🐱 Scratch 플랫폼 어댑터
 */
class ScratchAdapter extends BaseAdapter {
    constructor() {
        super('scratch');
    }

    async validate(projectData) {
        if (!projectData) {
            throw new Error('프로젝트 데이터가 없습니다.');
        }
        return true;
    }

    async process(projectData) {
        // Buffer나 객체를 그대로 반환 (S3 업로드용)
        if (Buffer.isBuffer(projectData)) {
            return projectData;
        } else if (typeof projectData === 'object') {
            return Buffer.from(JSON.stringify(projectData));
        } else if (typeof projectData === 'string') {
            return Buffer.from(projectData);
        }
        return projectData;
    }

    async analyze(projectData) {
        try {
            let json = null;

            // 1. JSON 객체인지 확인
            if (typeof projectData === 'object' && !Buffer.isBuffer(projectData)) {
                json = projectData;
            }
            // 2. Buffer인 경우 (JSON인지 확인)
            else if (Buffer.isBuffer(projectData)) {
                try {
                    const str = projectData.toString('utf8');
                    if (str.startsWith('{')) {
                        json = JSON.parse(str);
                    }
                } catch (e) {
                    // ZIP(sb3)일 가능성이 높음 -> 분석 생략 (나중에 unzip 라이브러리 추가 필요)
                }
            }

            if (json) {
                // TODO: 스크래치 JSON 구조 분석 로직 (targets -> blocks)
                // 현재는 간단히 targets 개수만
                const sprites = json.targets ? json.targets.length : 0;
                let blocks = 0;
                if (json.targets) {
                    json.targets.forEach(t => {
                        if (t.blocks) blocks += Object.keys(t.blocks).length;
                    });
                }

                return {
                    complexity: Math.min(Math.ceil(blocks / 20), 5),
                    blocks: blocks,
                    sprites: sprites,
                    variables: 0, // TODO: Extract
                    functions: 0  // TODO: Extract
                };
            }

            return {
                complexity: 0,
                blocks: 0,
                sprites: 0,
                variables: 0,
                functions: 0
            };

        } catch (error) {
            console.error('Scratch 프로젝트 분석 오류:', error);
            return { complexity: 0, blocks: 0 };
        }
    }

    getContentType() {
        return 'application/x-scratch';
    }

    getExtension() {
        return 'sb3';
    }

    async postProcess(buffer, userId, sessionID) {
        // 이미 Buffer이므로 그대로 반환하거나 필요한 처리가 있으면 수행
        return buffer;
    }
}

module.exports = ScratchAdapter;
