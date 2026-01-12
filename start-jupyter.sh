#!/bin/bash
set -e

# Configuration
MOUNT_POINT="/app/jupyter_notebooks"
BUCKET_NAME="${S3_BUCKET_NAME:-educodingnplaycontents}"
AWS_REGION="${AWS_REGION:-kr}"

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
    # Create password file for s3fs
    echo "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" > /root/.passwd-s3fs
    chmod 600 /root/.passwd-s3fs

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
else
    echo "❌ S3 Mount Failed!"
    # We might want to exit here, or continue with local storage fallback
    # exit 1 
fi

# Execute the passed command (Jupyter)
echo "🧹 Clearing Matplotlib cache..."
rm -rf /root/.cache/matplotlib

echo "📓 Starting Jupyter Notebook..."
exec "$@"
