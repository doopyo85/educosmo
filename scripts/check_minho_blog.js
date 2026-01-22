const { queryDatabase } = require('../lib_login/db');

async function checkBlog() {
    try {
        console.log('Checking user minho...');
        const users = await queryDatabase("SELECT id, name, userID FROM Users WHERE userID = 'minho'");
        console.log('User found:', users);

        if (users.length > 0) {
            const blogs = await queryDatabase("SELECT * FROM user_blogs WHERE user_id = ?", [users[0].id]);
            console.log('Blog found:', blogs);
        } else {
            console.log('User minho not found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkBlog();
