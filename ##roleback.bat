@echo off
chcp 65001 >nul
echo === 고급 깃 롤백 도구 ===

REM ===== 서버 정보 (디플로이 코드와 동일) =====
set SERVER_HOST=ec2-43-202-0-141.ap-northeast-2.compute.amazonaws.com
set KEY_FILE=C:\Users\User\Documents\pioneer\1. aws\pioneer.pem
set SERVER_USER=ubuntu
set SERVER_DIR=/var/www/html

:show_log
echo.
echo === 최근 20개 커밋 내역 ===
git log --oneline -20 --decorate --graph
echo.

:select_commit
echo === 롤백할 커밋을 선택하세요 ===
echo 1. 최신 커밋 (HEAD) 되돌리기 (revert)
echo 2. 특정 커밋 해시로 강제 리셋 (reset --hard)
echo 3. 커밋 로그 다시 보기
echo 4. 취소
echo.
set /p choice="선택 (1-4): "

if "%choice%"=="1" goto revert_head
if "%choice%"=="2" goto reset_to_commit
if "%choice%"=="3" goto show_log
if "%choice%"=="4" goto cancel
echo 잘못된 선택입니다.
goto select_commit

:revert_head
echo.
set /p confirm="최신 커밋을 revert 하시겠습니까? (y/N): "
if /i "%confirm%" neq "y" goto cancel

git revert HEAD --no-edit
if errorlevel 1 (
    echo ❌ Revert 실패!
    pause
    exit /b 1
)

goto push_and_deploy

:reset_to_commit
echo.
set /p commit_hash="커밋 해시 입력 (7자리 이상): "
if "%commit_hash%"=="" goto select_commit

git show -1 %commit_hash% >nul 2>&1
if errorlevel 1 (
    echo ❌ 유효하지 않은 커밋 해시입니다.
    goto select_commit
)

echo ⚠️ 경고: 이후 커밋이 모두 삭제됩니다!
set /p confirm="정말로 진행하려면 yes 입력: "
if /i "%confirm%" neq "yes" goto cancel

git reset --hard %commit_hash%
goto force_push_and_deploy

:push_and_deploy
git push origin main
if errorlevel 1 (
    echo ❌ 푸시 실패
    pause
    exit /b 1
)
goto deploy_server

:force_push_and_deploy
git push --force origin main
if errorlevel 1 (
    echo ❌ 강제 푸시 실패
    pause
    exit /b 1
)
goto deploy_server

:deploy_server
echo.
echo === 서버 롤백 배포 중 ===
ssh -i "%KEY_FILE%" -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_HOST% ^
"cd %SERVER_DIR% && git fetch origin && git reset --hard origin/main && pm2 restart server && echo '서버 롤백 완료'"

if errorlevel 1 (
    echo ❌ 서버 배포 실패
    pause
    exit /b 1
)

echo.
echo ✅ 롤백 및 서버 반영 완료
git log --oneline -3
pause
exit /b 0

:cancel
echo 작업이 취소되었습니다.
pause
exit /b 0
