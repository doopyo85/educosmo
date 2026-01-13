#!/bin/bash
# 🔥 에러 발생 시에도 계속 진행 (S3 마운트는 선택사항)
set +e

# Configuration
MOUNT_POINT="/app/jupyter_notebooks"
BUCKET_NAME="${S3_BUCKET_NAME:-educodingnplaycontents}"
AWS_REGION="${AWS_REGION:-kr}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-https://kr.object.ncloudstorage.com}"

echo "🔧 Configuration:"
echo "  MOUNT_POINT=$MOUNT_POINT"
echo "  BUCKET_NAME=$BUCKET_NAME"
echo "  AWS_REGION=$AWS_REGION"
echo "  S3_ENDPOINT_URL=$S3_ENDPOINT_URL"

# Ensure mount point exists
mkdir -p "$MOUNT_POINT"
echo "✅ Mount point directory created/verified"

# Unmount if already mounted (for restarting containers)
if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    echo "🔄 Unmounting existing S3 mount..."
    umount "$MOUNT_POINT" 2>/dev/null || true
fi

# 🔥 S3FS 마운트는 호스트에서 직접 수행됩니다.
# Docker 볼륨 마운트와 충돌하므로 컨테이너 내부에서는 마운트하지 않습니다.
echo "📁 Using host-mounted directory: $MOUNT_POINT"
if [ -d "$MOUNT_POINT" ]; then
    echo "✅ Jupyter notebooks directory exists"
    ls -la "$MOUNT_POINT" | head -10
else
    echo "⚠️  Creating jupyter notebooks directory..."
    mkdir -p "$MOUNT_POINT"
fi

# Execute the passed command (Jupyter)
echo "🧹 Clearing Matplotlib cache..."
rm -rf /root/.cache/matplotlib

echo "📓 Starting Jupyter Notebook..."
exec "$@"
