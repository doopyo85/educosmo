/**
 * 확장프로그램 패키징 스크립트
 *
 * extension 폴더를 ZIP으로 압축하여 public/extension 폴더에 복사합니다.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const extensionDir = path.join(__dirname, '..', 'extension');
const publicDir = path.join(__dirname, '..', 'public', 'extension');
const outputFile = path.join(publicDir, 'codingnplay-extension.zip');

// public/extension 폴더가 없으면 생성
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// 기존 ZIP 파일 삭제
if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
    console.log('🗑️  기존 ZIP 파일 삭제됨');
}

// ZIP 파일 생성
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
    zlib: { level: 9 } // 최대 압축
});

output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log('✅ ZIP 파일 생성 완료!');
    console.log(`📦 파일: ${outputFile}`);
    console.log(`📊 크기: ${sizeInMB} MB`);
    console.log('');
    console.log('다음 파일들이 포함되었습니다:');
    console.log('  - manifest.json');
    console.log('  - background.js');
    console.log('  - content.js');
    console.log('  - content-codingnplay.js');
    console.log('  - popup/ (HTML, CSS, JS)');
    console.log('  - styles/ (CSS)');
    console.log('  - lib/ (유틸리티)');
    console.log('  - icons/ (아이콘 생성 도구)');
    console.log('  - README.md');
});

archive.on('error', (err) => {
    console.error('❌ ZIP 생성 실패:', err);
    throw err;
});

archive.pipe(output);

// 제외할 파일/폴더
const excludeFiles = [
    'node_modules',
    '.git',
    '.DS_Store',
    'Thumbs.db',
    '*.zip'
];

// extension 폴더의 모든 파일 추가
console.log('📦 확장프로그램 패키징 중...');
archive.directory(extensionDir, false, (entry) => {
    // 제외할 파일 체크
    for (const exclude of excludeFiles) {
        if (entry.name.includes(exclude)) {
            return false;
        }
    }
    return entry;
});

archive.finalize();
