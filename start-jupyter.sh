#!/bin/bash
set -e

# Configuration
MOUNT_POINT="/app/jupyter_notebooks"
BUCKET_NAME="${S3_BUCKET_NAME:-educodingnplaycontents}"
AWS_REGION="${AWS_REGION:-kr}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-https://kr.object.ncloudstorage.com}"

# Ensure mount point exists
mkdir -p "$MOUNT_POINT"

# Unmount if already mounted (for restarting containers)
if mountpoint -q "$MOUNT_POINT"; then
    echo "🔄 Unmounting existing S3 mount..."
    umount "$MOUNT_POINT" || true
fi

echo "🚀 Mounting S3 Bucket: $BUCKET_NAME to $MOUNT_POINT"
echo "🔍 DEBUG: AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:0:10}..."
echo "🔍 DEBUG: S3_ENDPOINT_URL=$S3_ENDPOINT_URL"
echo "🔍 DEBUG: AWS_REGION=$AWS_REGION"

# Mount S3 using s3fs
# NCP Object Storage requires explicit credentials, not IAM role
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "✅ Using provided AWS credentials"

    # 🔥 s3fs 설치 확인
    if ! command -v s3fs &> /dev/null; then
        echo "❌ s3fs가 설치되어 있지 않습니다. S3 마운트를 건너뜁니다."
        echo "📓 로컬 파일시스템으로 계속 진행합니다..."
    else
    # Create password file for s3fs
    echo "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" > /root/.passwd-s3fs
    chmod 600 /root/.passwd-s3fs

        echo "🔄 s3fs 마운트 시작..."
        s3fs "$BUCKET_NAME" "$MOUNT_POINT" \
            -o passwd_file=/root/.passwd-s3fs \
            -o allow_other \
            -o use_cache=/tmp \
            -o uid=$(id -u),gid=$(id -g) \
            -o mp_umask=002 \
            -o multireq_max=5 \
            -o url="$S3_ENDPOINT_URL" \
            -o use_path_request_style \
            -o dbglevel=info \
            -o nonempty

        # Wait for mount to complete
        sleep 2
    fi
else
    echo "⚠️  No AWS credentials provided, attempting IAM role..."
    s3fs "$BUCKET_NAME" "$MOUNT_POINT" \
        -o iam_role=auto \
        -o allow_other \
        -o use_cache=/tmp \
        -o uid=$(id -u),gid=$(id -g) \
        -o mp_umask=002 \
        -o multireq_max=5 \
        -o url="${S3_ENDPOINT_URL:-https://s3.$AWS_REGION.amazonaws.com}" \
        -o dbglevel=info \
        -o nonempty
fi

# Check if mount was successful
if mountpoint -q "$MOUNT_POINT"; then
    echo "✅ S3 Mounted Successfully!"
    ls -la "$MOUNT_POINT" | head -10
else
    echo "❌ S3 Mount Failed!"
    echo "📁 Using local filesystem: $MOUNT_POINT"
    # 로컬 디렉토리가 존재하는지 확인
    if [ -d "$MOUNT_POINT" ]; then
        echo "✅ Local directory exists"
        ls -la "$MOUNT_POINT" | head -10
    else
        echo "⚠️  Creating local directory..."
        mkdir -p "$MOUNT_POINT"
    fi
fi

# Execute the passed command (Jupyter)
echo "🧹 Clearing Matplotlib cache..."
rm -rf /root/.cache/matplotlib

echo "📓 Starting Jupyter Notebook..."
exec "$@"
