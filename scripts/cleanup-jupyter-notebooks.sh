#!/bin/bash

# Jupyter 노트북 정리 스크립트
LOG_FILE="/var/www/html/logs/jupyter-cleanup.log"
NOTEBOOK_DIR="/var/www/html/jupyter_notebooks"

# 로그 시작
echo "=== Jupyter 노트북 정리 시작: $(date) ===" >> "$LOG_FILE"

# 1. 7일 이상 된 사용자별 노트북 파일 삭제
echo "7일 이상 된 노트북 파일 정리..." >> "$LOG_FILE"
find "$NOTEBOOK_DIR" -name "*.ipynb" -type f -mtime +7 -exec rm -f {} \; -print >> "$LOG_FILE" 2>&1

# 2. 빈 사용자 디렉토리 정리
echo "빈 사용자 디렉토리 정리..." >> "$LOG_FILE"
find "$NOTEBOOK_DIR" -type d -empty -delete -print >> "$LOG_FILE" 2>&1

# 3. 루트 레벨의 Untitled 파일들 (3일 이상) 정리
echo "루트 레벨 Untitled 파일 정리..." >> "$LOG_FILE"
find "$NOTEBOOK_DIR" -maxdepth 1 -name "Untitled*.ipynb" -type f -mtime +3 -exec rm -f {} \; -print >> "$LOG_FILE" 2>&1

# 4. 임시 Python 파일 정리
echo "임시 Python 파일 정리..." >> "$LOG_FILE"
find /var/www/html -name "temp_interactive_*.py" -type f -mtime +1 -exec rm -f {} \; -print >> "$LOG_FILE" 2>&1

# 5. 디스크 사용량 확인
echo "정리 후 디스크 사용량:" >> "$LOG_FILE"
du -sh "$NOTEBOOK_DIR" >> "$LOG_FILE"

echo "=== 정리 완료: $(date) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
