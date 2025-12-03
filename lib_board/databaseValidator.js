const db = require('../lib_login/db');

/**
 * 데이터베이스 스키마 확장 및 검증 유틸리티
 */

/**
 * 테이블 존재 여부 확인
 */
async function checkTableExists(tableName) {
    try {
        const [result] = await db.queryDatabase(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = ?
        `, [tableName]);
        
        return result.count > 0;
    } catch (error) {
        console.error(`테이블 존재 확인 오류 (${tableName}):`, error);
        return false;
    }
}

/**
 * 컬럼 존재 여부 확인
 */
async function checkColumnExists(tableName, columnName) {
    try {
        const [result] = await db.queryDatabase(`
            SELECT COUNT(*) as count 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = ? 
            AND column_name = ?
        `, [tableName, columnName]);
        
        return result.count > 0;
    } catch (error) {
        console.error(`컬럼 존재 확인 오류 (${tableName}.${columnName}):`, error);
        return false;
    }
}

/**
 * 인덱스 존재 여부 확인
 */
async function checkIndexExists(tableName, indexName) {
    try {
        const [result] = await db.queryDatabase(`
            SELECT COUNT(*) as count 
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = ? 
            AND index_name = ?
        `, [tableName, indexName]);
        
        return result.count > 0;
    } catch (error) {
        console.error(`인덱스 존재 확인 오류 (${tableName}.${indexName}):`, error);
        return false;
    }
}

/**
 * 스키마 상태 전체 검증
 */
async function validateDatabaseSchema() {
    const checks = {
        tables: {},
        columns: {},
        indexes: {},
        triggers: {}
    };
    
    try {
        // 1. 테이블 존재 확인
        checks.tables.board_attachments = await checkTableExists('board_attachments');
        checks.tables.board_upload_stats = await checkTableExists('board_upload_stats');
        checks.tables.board_upload_logs = await checkTableExists('board_upload_logs');
        checks.tables.board_temp_files = await checkTableExists('board_temp_files');
        
        // 2. board_attachments 새 컬럼 확인
        if (checks.tables.board_attachments) {
            checks.columns.upload_progress = await checkColumnExists('board_attachments', 'upload_progress');
            checks.columns.is_image = await checkColumnExists('board_attachments', 'is_image');
            checks.columns.thumbnail_url = await checkColumnExists('board_attachments', 'thumbnail_url');
            checks.columns.is_temporary = await checkColumnExists('board_attachments', 'is_temporary');
            checks.columns.temp_expires_at = await checkColumnExists('board_attachments', 'temp_expires_at');
            checks.columns.file_hash = await checkColumnExists('board_attachments', 'file_hash');
            checks.columns.upload_ip = await checkColumnExists('board_attachments', 'upload_ip');
            checks.columns.metadata = await checkColumnExists('board_attachments', 'metadata');
            checks.columns.status = await checkColumnExists('board_attachments', 'status');
        }
        
        // 3. Users 테이블 컬럼 확인
        checks.columns.last_board_visit = await checkColumnExists('Users', 'last_board_visit');
        
        // 4. board_posts 새 컬럼 확인
        checks.columns.attachment_count = await checkColumnExists('board_posts', 'attachment_count');
        checks.columns.has_images = await checkColumnExists('board_posts', 'has_images');
        
        // 5. 인덱스 확인
        if (checks.tables.board_attachments) {
            checks.indexes.idx_post_id = await checkIndexExists('board_attachments', 'idx_post_id');
            checks.indexes.idx_is_image = await checkIndexExists('board_attachments', 'idx_is_image');
            checks.indexes.idx_is_temporary = await checkIndexExists('board_attachments', 'idx_is_temporary');
            checks.indexes.idx_file_hash = await checkIndexExists('board_attachments', 'idx_file_hash');
        }
        
        // 6. 트리거 확인
        const [triggers] = await db.queryDatabase(`
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE trigger_schema = DATABASE() 
            AND trigger_name IN ('update_post_attachment_count_insert', 'update_post_attachment_count_delete')
        `);
        
        checks.triggers.update_post_attachment_count_insert = triggers.some(t => 
            t.trigger_name === 'update_post_attachment_count_insert'
        );
        checks.triggers.update_post_attachment_count_delete = triggers.some(t => 
            t.trigger_name === 'update_post_attachment_count_delete'
        );
        
        return checks;
        
    } catch (error) {
        console.error('스키마 검증 오류:', error);
        return null;
    }
}

/**
 * 스키마 상태 리포트 생성
 */
async function generateSchemaReport() {
    const validation = await validateDatabaseSchema();
    
    if (!validation) {
        return {
            status: 'error',
            message: '스키마 검증 중 오류가 발생했습니다.',
            ready: false
        };
    }
    
    const report = {
        status: 'success',
        timestamp: new Date().toISOString(),
        checks: validation,
        ready: true,
        missing: [],
        recommendations: []
    };
    
    // 누락된 요소 확인
    Object.entries(validation).forEach(([category, items]) => {
        Object.entries(items).forEach(([name, exists]) => {
            if (!exists) {
                report.missing.push(`${category}.${name}`);
                report.ready = false;
            }
        });
    });
    
    // 권장사항 생성
    if (report.missing.length > 0) {
        report.recommendations.push('database_schema_update.sql 파일을 실행하여 스키마를 업데이트하세요.');
    }
    
    if (!validation.tables.board_upload_stats) {
        report.recommendations.push('업로드 통계 추적을 위해 board_upload_stats 테이블이 필요합니다.');
    }
    
    if (!validation.tables.board_upload_logs) {
        report.recommendations.push('보안 모니터링을 위해 board_upload_logs 테이블이 필요합니다.');
    }
    
    return report;
}

/**
 * 업로드 통계 초기화
 */
async function initializeUploadStats(userId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        await db.queryDatabase(`
            INSERT IGNORE INTO board_upload_stats 
            (user_id, ip_address, upload_date, file_count, total_size) 
            VALUES (?, '0.0.0.0', ?, 0, 0)
        `, [userId, today]);
        
        return true;
    } catch (error) {
        console.error('업로드 통계 초기화 오류:', error);
        return false;
    }
}

/**
 * 데이터 마이그레이션 실행
 */
async function migrateExistingData() {
    try {
        console.log('기존 데이터 마이그레이션 시작...');
        
        // 1. 기존 첨부파일의 is_image 업데이트
        await db.queryDatabase(`
            UPDATE board_attachments 
            SET is_image = TRUE 
            WHERE file_type LIKE 'image/%' AND is_image = FALSE
        `);
        
        // 2. 게시글의 첨부파일 개수 업데이트
        await db.queryDatabase(`
            UPDATE board_posts bp 
            SET attachment_count = (
                SELECT COUNT(*) 
                FROM board_attachments ba 
                WHERE ba.post_id = bp.id AND ba.is_temporary = FALSE
            )
        `);
        
        // 3. 게시글의 이미지 존재 여부 업데이트
        await db.queryDatabase(`
            UPDATE board_posts bp 
            SET has_images = (
                SELECT COUNT(*) > 0
                FROM board_attachments ba 
                WHERE ba.post_id = bp.id 
                AND ba.is_image = TRUE 
                AND ba.is_temporary = FALSE
            )
        `);
        
        console.log('기존 데이터 마이그레이션 완료');
        return true;
        
    } catch (error) {
        console.error('데이터 마이그레이션 오류:', error);
        return false;
    }
}

module.exports = {
    checkTableExists,
    checkColumnExists,
    checkIndexExists,
    validateDatabaseSchema,
    generateSchemaReport,
    initializeUploadStats,
    migrateExistingData
};
