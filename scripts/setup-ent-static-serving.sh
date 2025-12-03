#!/bin/bash

# 8070번 서버에 정적 파일 서빙 설정 추가

echo "🔧 8070번 서버에 ENT 이미지 정적 파일 서빙 추가 중..."

# 8070번 서버 설정 파일 백업
sudo cp /var/www/html/entry/server.js /var/www/html/entry/server.js.backup

# 정적 파일 서빙 설정 추가
sudo tee -a /var/www/html/entry/server.js > /dev/null << 'EOF'

// 🖼️ ENT 파일 이미지 정적 파일 서빙 추가
app.use('/temp', express.static('/var/www/html/temp/ent_files', {
    setHeaders: (res, path) => {
        console.log(`🖼️ ENT 이미지 서빙: ${path}`);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

console.log('✅ ENT 이미지 정적 파일 서빙 설정 완료: /temp -> /var/www/html/temp/ent_files');
EOF

echo "✅ 8070번 서버 설정 추가 완료"
