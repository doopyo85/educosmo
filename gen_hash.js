const bcrypt = require('bcrypt');

async function main() {
    const hash = await bcrypt.hash('123456', 10);
    console.log('HASH:', hash);
}
main();
