#!/bin/bash
set -e

# Configuration
MOUNT_POINT="/app/jupyter_notebooks"
BUCKET_NAME="${S3_BUCKET_NAME:-educodingnplaycontents}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"

# Check for S3 credentials or IAM Role
# If no keys are provided, we assume IAM Role is attached to the instance.
if [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "ℹ️  No env credentials found. Assuming IAM Role (instance metadata)..."
fi

# Ensure mount point exists
mkdir -p "$MOUNT_POINT"

# Unmount if already mounted (for restarting containers)
if mountpoint -q "$MOUNT_POINT"; then
    echo "🔄 Unmounting existing S3 mount..."
    umount "$MOUNT_POINT" || true
fi

echo "🚀 Mounting S3 Bucket: $BUCKET_NAME to $MOUNT_POINT"

# Mount S3 using s3fs
# -o iam_role=auto: Use EC2 IAM Role
# -o allow_other: Allow all users to access the mount
# -o use_cache: Cache files locally for performance
# -o uid/gid: Map ownership to current user (usually root or 1000)
# -o mp_umask: Set permissions
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
