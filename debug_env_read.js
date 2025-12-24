const fs = require('fs');
try {
    const content = fs.readFileSync('.env', 'utf8');
    console.log('File length:', content.length);
    console.log('First 50 chars:', content.substring(0, 50).replace(/\r/g, '\\r').replace(/\n/g, '\\n'));

    // Check for keys without printing values
    const lines = content.split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length > 0) console.log('Key found:', parts[0].trim());
    });
} catch (e) {
    console.error(e);
}
