const { queryDatabase } = require('../lib_login/db');

async function debugUser() {
    try {
        console.log('🔍 Debugging user: cosmoedu');

        // 1. Get User Info
        const [user] = await queryDatabase('SELECT * FROM Users WHERE userID = ?', ['cosmoedu']);
        if (!user) {
            console.log('❌ User cosmoedu not found!');
            return;
        }

        console.log('✅ User Found:', {
            id: user.id,
            userID: user.userID,
            role: user.role,
            centerID: user.centerID,
            name: user.name
        });

        if (!user.centerID) {
            console.log('⚠️ centerID is null/empty!');
        } else {
            // 2. Get Center Info
            const [center] = await queryDatabase('SELECT * FROM Centers WHERE id = ?', [user.centerID]);
            console.log('🏢 Center Info:', center);

            // 3. Get Students in Center
            const students = await queryDatabase('SELECT id, userID, name, role FROM Users WHERE centerID = ? AND role = "student"', [user.centerID]);
            console.log(`👨‍🎓 Students in Center (${students.length}):`);
            students.forEach(s => console.log(` - [${s.userID}] ${s.name} (${s.role})`));
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        process.exit();
    }
}

debugUser();
