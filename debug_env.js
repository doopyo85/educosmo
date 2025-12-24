const dotenv = require('dotenv');
const result = dotenv.config();

console.log('Dotenv parsed:', result.parsed ? Object.keys(result.parsed) : 'Error/None');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('CWD:', process.cwd());
