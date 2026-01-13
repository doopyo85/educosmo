#!/bin/bash
set -e
echo "=== Jupyter 시작: $(date) ==="

# 작업 디렉토리
cd /var/www/html

# 시스템 Jupyter 확인
if ! /usr/local/bin/python3.10 -m jupyter --version &> /dev/null; then
    echo "❌ ERROR: Jupyter가 설치되지 않았습니다."
    exit 1
fi

echo "✅ Python: /usr/local/bin/python3.10"
echo "✅ Jupyter Version: $(/usr/local/bin/python3.10 -m jupyter --version | head -1)"

# ✅ 한글 폰트 설정 파일 생성
echo "🔧 한글 폰트 설정 파일 생성..."
mkdir -p ~/.ipython/profile_default/startup
cat > ~/.ipython/profile_default/startup/00-korean-font.py << 'EOF'
# 한글 폰트 자동 설정
try:
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    
    korean_fonts = ['NanumGothic', 'NanumBarunGothic', 'Malgun Gothic', 'Noto Sans CJK KR']
    available_fonts = [f.name for f in fm.fontManager.ttflist]
    
    for font in korean_fonts:
        if font in available_fonts:
            plt.rcParams['font.family'] = font
            plt.rcParams['axes.unicode_minus'] = False
            print(f"✅ 한글 폰트 자동 설정: {font}")
            break
    else:
        print("⚠️  한글 폰트를 찾을 수 없습니다.")
        
except ImportError:
    pass
EOF

echo "✅ 한글 폰트 설정 완료"

# 노트북 디렉토리로 이동
cd jupyter_notebooks

# Jupyter 서버 실행 (시스템 Python 사용)
exec /usr/local/bin/python3.10 -m jupyter notebook \
  --ip=0.0.0.0 \
  --port=8000 \
  --no-browser \
  --allow-root \
  --NotebookApp.base_url=/jupyter \
  --NotebookApp.token= \
  --NotebookApp.password= \
  --NotebookApp.disable_check_xsrf=True \
  --NotebookApp.allow_origin="*" \
  --NotebookApp.allow_remote_access=True
