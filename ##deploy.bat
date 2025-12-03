@echo off
echo === 변경사항 푸시 중 ===
git add .
set /p commit_msg="커밋 메시지를 입력하세요: "
git commit -m "%commit_msg%"
git push origin main

echo === 서버에 접속하여 배포 중 ===

REM ?? 수정: 도메인명 또는 현재 IP 사용
set SERVER_HOST=ec2-43-202-0-141.ap-northeast-2.compute.amazonaws.com
set KEY_FILE=C:\Users\User\Documents\pioneer\1. aws\pioneer.pem

REM SSH 연결 테스트
echo 서버 연결 테스트 중...
ssh -i "%KEY_FILE%" -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@%SERVER_HOST% "echo 'SSH 연결 성공'"

if %ERRORLEVEL% NEQ 0 (
    echo SSH 연결 실패! 다음을 확인하세요:
    echo 1. AWS EC2 인스턴스가 실행 중인지 확인
    echo 2. 보안 그룹에서 SSH 포트 22번이 열려있는지 확인
    echo 3. 키 파일 경로: %KEY_FILE%
    echo 4. 서버 호스트: %SERVER_HOST%
    pause
    exit /b 1
)

echo SSH 연결 성공! Git Pull 실행 중...

REM 프로젝트 디렉토리로 이동 및 배포
ssh -i "%KEY_FILE%" -o ConnectTimeout=30 -o StrictHostKeyChecking=no ubuntu@%SERVER_HOST% "cd /var/www/html/ && git stash && git pull origin main && touch public/css/styles.css && touch public/css/common-layout.css && pm2 restart server && echo '배포 완료!'"

if %ERRORLEVEL% EQU 0 (
    echo === 배포 성공! ===
    echo 브라우저에서 Ctrl+Shift+R로 새로고침하세요.
) else (
    echo === 배포 실패! ===
    echo 서버 로그를 확인하세요.
)

pause