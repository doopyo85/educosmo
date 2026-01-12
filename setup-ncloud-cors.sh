#!/bin/bash

# 네이버 클라우드 Object Storage CORS 설정 스크립트
# 사용법: ./setup-ncloud-cors.sh

echo "=================================="
echo "네이버 클라우드 Object Storage 설정"
echo "=================================="

# 환경변수 로드
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

BUCKET_NAME="educodingnplaycontents"
ENDPOINT_URL="https://kr.object.ncloudstorage.com"

# CORS 설정 파일 생성
cat > /tmp/ncloud-cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

echo ""
echo "1단계: CORS 설정 적용 중..."
echo "------------------------------------"

# AWS CLI가 설치되어 있는지 확인
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI가 설치되어 있지 않습니다."
    echo "다음 명령어로 설치하세요:"
    echo "  sudo apt install -y awscli"
    echo "  또는"
    echo "  curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
    echo "  unzip awscliv2.zip"
    echo "  sudo ./aws/install"
    exit 1
fi

# API 인증키 확인
if [ -z "$NCP_ACCESS_KEY_ID" ] || [ -z "$NCP_SECRET_KEY" ]; then
    echo "⚠️  네이버 클라우드 API 인증키가 설정되지 않았습니다."
    echo ""
    echo ".env 파일에 다음 환경변수를 추가하세요:"
    echo "  NCP_ACCESS_KEY_ID=your-access-key-id"
    echo "  NCP_SECRET_KEY=your-secret-key"
    echo ""
    echo "API 인증키는 네이버 클라우드 콘솔에서 발급받을 수 있습니다:"
    echo "  https://console.ncloud.com → 마이페이지 → 인증키 관리"
    exit 1
fi

# AWS 인증 정보 설정
export AWS_ACCESS_KEY_ID="$NCP_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$NCP_SECRET_KEY"

# CORS 설정 적용
echo "CORS 규칙을 버킷에 적용하는 중..."
if aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration file:///tmp/ncloud-cors.json \
    --endpoint-url "$ENDPOINT_URL" 2>&1; then
    echo "✅ CORS 설정이 완료되었습니다!"
else
    echo "❌ CORS 설정에 실패했습니다."
    echo "웹 콘솔에서 직접 설정하거나 API 인증키를 확인하세요."
fi

echo ""
echo "2단계: CORS 설정 확인 중..."
echo "------------------------------------"

if aws s3api get-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --endpoint-url "$ENDPOINT_URL" 2>&1; then
    echo "✅ CORS 설정 확인 완료!"
else
    echo "⚠️  CORS 설정을 확인할 수 없습니다."
fi

echo ""
echo "3단계: 파일 공개 설정"
echo "------------------------------------"
echo "⚠️  버킷의 개별 파일을 공개하려면 다음 명령어를 실행하세요:"
echo ""
echo "# 전체 버킷 공개 (주의: 모든 파일이 공개됩니다!)"
echo "aws s3 cp s3://$BUCKET_NAME/ s3://$BUCKET_NAME/ \\"
echo "  --recursive \\"
echo "  --acl public-read \\"
echo "  --endpoint-url $ENDPOINT_URL"
echo ""
echo "# 특정 폴더만 공개"
echo "aws s3 cp s3://$BUCKET_NAME/Github_sync_contents/ s3://$BUCKET_NAME/Github_sync_contents/ \\"
echo "  --recursive \\"
echo "  --acl public-read \\"
echo "  --endpoint-url $ENDPOINT_URL"
echo ""
echo "=================================="
echo "설정이 완료되었습니다!"
echo "=================================="

# 임시 파일 삭제
rm -f /tmp/ncloud-cors.json
