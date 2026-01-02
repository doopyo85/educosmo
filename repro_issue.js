const { exec } = require('child_process');
const fs = require('fs');

const fileName = 'temp_Wen Park_test.py';
const code = 'print("Hello World")';

fs.writeFileSync(fileName, code);

console.log(`Created file: ${fileName}`);

// Simulating the bug: no quotes around fileName
const cmd = `python ${fileName}`; // using python instead of python3 for windows compatibility if needed
console.log(`Executing: ${cmd}`);

exec(cmd, (error, stdout, stderr) => {
    if (error) {
        console.error('Error:', error.message);
    }
    if (stderr) {
        console.error('Stderr:', stderr);
    }
    console.log('Stdout:', stdout);

    // Cleanup
    fs.unlinkSync(fileName);
});
