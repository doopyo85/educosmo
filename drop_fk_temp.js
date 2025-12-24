
const mysql = require('mysql2/promise');

async function dropConstraint() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: 'fq84cod3#@',
            database: 'educodingnplay',
            port: 3306
        });

        console.log('Connected! Dropping Foreign Key board_posts_ibfk_2...');
        await connection.query('ALTER TABLE board_posts DROP FOREIGN KEY board_posts_ibfk_2');
        console.log('Successfully dropped foreign key.');

    } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log('Foreign key might not exist or already dropped.');
        } else {
            console.error('Error:', error);
        }
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

dropConstraint();
