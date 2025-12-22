
const EntFileManager = require('./lib_entry/entFileManager');

async function test() {
    try {
        console.log('Instantiating EntFileManager...');
        const manager = new EntFileManager();
        console.log('EntFileManager instantiated.');

        const s3Url = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/entry/projects/sample.ent'; // Fake URL to test logic until download
        console.log('Testing loadProjectFromS3 with URL:', s3Url);

        // We expect this to fail at download if file doesn't exist, but NOT throw 500 (crash)
        const result = await manager.loadProjectFromS3(s3Url, 'testuser', 'testsession');
        console.log('Result:', result);

    } catch (error) {
        console.error('CRASHED:', error);
    }
}

test();
