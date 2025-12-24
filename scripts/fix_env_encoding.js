const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

try {
    // Try reading as UTF-16LE
    const content = fs.readFileSync(envPath, 'utf16le');

    // Check if it looks reasonable (e.g., contains 'DB_HOST')
    if (content.includes('DB_HOST')) {
        console.log('Detected UTF-16LE content. Converting to UTF-8...');
        fs.writeFileSync(envPath, content, 'utf8');
        console.log('Conversion successful.');
    } else {
        console.log('Content does not verify as valid .env properties. Aborting conversion.');
        // Maybe it's not UTF-16LE but something else?
        // But the previous debug output showed keys spaced out, which is typical for UTF-16 interpretation as UTF-8 default, 
        // OR it was printed as chars. If I read as UTF-16LE and it works, then great.
    }
} catch (e) {
    console.error('Error:', e.message);
}
