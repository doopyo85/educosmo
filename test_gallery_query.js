const db = require('./lib_login/db');

async function testGalleryQuery() {
    try {
        console.log('Testing Gallery Query Parameters...');

        // Mock Session Values
        const sessionUser = 'testuser';
        const sessionCenterId = 1;
        const platform = undefined; // mock
        const userId = 'targetUserId'; // mock
        const featured = undefined; // mock
        const finalLimit = 20;
        const offset = 0;

        let whereConditions = ['gp.is_active = 1'];
        let params = [];

        // Logic from galleryApiRouter.js
        if (sessionUser) {
            whereConditions.push(`(
                gp.visibility = 'public' 
                OR (gp.visibility = 'class' AND u.centerID = ?)
                OR u.userID = ?
            )`);
            params.push(sessionCenterId, sessionUser);
        } else {
            whereConditions.push(`gp.visibility = 'public'`);
        }

        if (userId) {
            whereConditions.push('u.userID = ?');
            params.push(userId);
        }

        const orderBy = 'gp.created_at DESC';

        const query = `
            SELECT 
                gp.id
            FROM gallery_projects gp
            JOIN Users u ON gp.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `;

        params.push(finalLimit, offset);

        console.log('Query:', query);
        console.log('Params:', params);
        console.log('Param Count:', params.length);
        console.log('Placeholder Count in Query:', (query.match(/\?/g) || []).length);

        if (params.length !== (query.match(/\?/g) || []).length) {
            console.error('MISMATCH DETECTED!');
        } else {
            console.log('Parameter count matches placeholders.');
        }

        // Attempt Execution
        await db.queryDatabase(query, params);
        console.log('Query Executed Successfully (Mock Data)');

    } catch (error) {
        console.error('Query Execution Failed:', error);
    }
    process.exit();
}

testGalleryQuery();
