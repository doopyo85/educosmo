# Base Image
FROM node:18-slim

# Install system dependencies and Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    git \
#    ffmpeg \  # Uncomment if sound processing needed
    && rm -rf /var/lib/apt/lists/*

# Set Timezone to KST
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# App Directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
# Install production dependencies only initially, but since we might need dev tools or full install:
RUN npm install

# Install Jupyter and Python dependencies
# Creating a virtual environment or installing globally? 
# For Docker, global pip install is often acceptable if it's the only app.
# But let's be safe and separate if possible, or just install to system python.
# System python is typically /usr/bin/python3
RUN pip3 install --no-cache-dir \
    jupyter \
    notebook \
    numpy \
    pandas \
    matplotlib \
    requests

# Copy Source Code
COPY . .

# Create necessary directories for Jupyter/Uploads if they don't exist
RUN mkdir -p jupyter_notebooks public/uploads

# Expose Ports
# 3000: Base Express App
# 8000-8100: Reserved for Jupyter if needed (though we currently spawn it)
EXPOSE 3000

# Start Command
# Using dumb-init or integrated node
CMD ["npm", "start"]
