@echo off
echo === 고급 깃 롤백 도구 ===
chcp 65001 >nul

:show_log
echo.
echo === 최근 20개 커밋 내역 ===
git log --oneline -20 --decorate --graph
echo.

:select_commit
echo === 롤백할 커밋을 선택하세요 ===
echo 1. 최신 커밋 (HEAD) 되돌리기
echo 2. 특정 커밋 해시로 강제 리셋
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
echo === HEAD 커밋 되돌리기 ===
set /p confirm="최신 커밋을 revert 하시겠습니까? (y/N): "
if /i "%confirm%" neq "y" goto cancel

echo.
echo === Revert 실행 중... ===
git revert HEAD --no-edit
if errorlevel 1 (
    echo ❌ Revert 실패!
    pause
    exit /b 1
)

echo ✅ Revert 완료
goto push_and_deploy

:reset_to_commit
echo.
echo === 특정 커밋으로 강제 리셋 ===
set /p commit_hash="커밋 해시 입력 (처음 7자리만): "
if "%commit_hash%"=="" (
    echo 커밋 해시가 입력되지 않았습니다.
    goto select_commit
)

echo.
echo 선택된 커밋: %commit_hash%
git show --oneline -1 %commit_hash% 2>nul
if errorlevel 1 (
    echo ❌ 유효하지 않은 커밋 해시입니다.
    goto select_commit
)

echo.
echo ⚠️  위험: 이 작업은 선택한 커밋 이후의 모든 변경사항을 삭제합니다!
set /p confirm="정말로 %commit_hash%로 강제 리셋하시겠습니까? (yes 입력): "
if /i "%confirm%" neq "yes" goto cancel

echo.
echo === 강제 리셋 실행 중... ===
git reset --hard %commit_hash%
if errorlevel 1 (
    echo ❌ 리셋 실패!
    pause
    exit /b 1
)

echo ✅ 로컬 리셋 완료
goto force_push_and_deploy

:push_and_deploy
echo.
echo === 서버에 푸시 중... ===
git push origin main
if errorlevel 1 (
    echo ❌ 푸시 실패!
    pause
    exit /b 1
)

echo ✅ 푸시 완료
goto deploy_server

:force_push_and_deploy
echo.
echo === 서버에 강제 푸시 중... ===
git push --force origin main
if errorlevel 1 (
    echo ❌ 강제 푸시 실패!
    pause
    exit /b 1
)

echo ✅ 강제 푸시 완료
goto deploy_server

:deploy_server
echo.
echo === 서버 배포 중... ===
echo 서버에 접속하여 코드 업데이트 및 재시작...
ssh -i "C:\Users\admin\pioneer.pem" ubuntu@3.34.127.154 "cd /var/www/html && git reset --hard origin/main && git pull origin main && pm2 restart server"
if errorlevel 1 (
    echo ❌ 서버 배포 실패!
    echo 수동으로 서버를 확인해주세요.
    pause
    exit /b 1
)

echo.
echo === ✅ 모든 작업 완료! ===
echo 로컬과 서버 모두 업데이트되었습니다.
goto end

:cancel
echo.
echo === 작업이 취소되었습니다 ===
goto end

:end
echo.
echo 현재 상태:
git log --oneline -3
echo.
pause