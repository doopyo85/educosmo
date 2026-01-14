# Base Image - Python 3.10 for TensorFlow compatibility
FROM python:3.10-slim

# Install system dependencies
# - s3fs, fuse: For S3 mounting
# - fonts-nanum, fonts-nanum-coding, fonts-noto-cjk: For Korean font support
# - graphviz, libgl1-mesa-glx: For visualization and opencv
# - build-essential, git: For installing some python packages
RUN apt-get update && apt-get install -y \
    s3fs \
    fuse \
    fonts-nanum \
    fonts-nanum-coding \
    fonts-noto-cjk \
    fontconfig \
    fonts-dejavu \
    build-essential \
    curl \
    git \
    procps \
    vim \
    graphviz \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# Set Timezone to KST
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Matplotlib Configuration
ENV MPLCONFIGDIR=/etc/matplotlib
COPY matplotlibrc /etc/matplotlib/matplotlibrc

# Create a configuration file for matplotlib to use NanumGothic by default
# This helps avoid runtime configuration issues for some plots
RUN mkdir -p /root/.config/matplotlib
RUN echo "font.family : NanumGothic" > /root/.config/matplotlib/matplotlibrc
RUN echo "axes.unicode_minus : False" >> /root/.config/matplotlib/matplotlibrc

# Font Configuration (Alias Malgun Gothic -> NanumGothic)
COPY local.conf /etc/fonts/local.conf

# Install updated Node.js (needed if this container runs node scripts, but primarily it's python now)
# If this container is purely for Jupyter, we might not need Node.js explicitly unless extensions require it.
# Keeping it minimal for now.

WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Jupyter explicitly if not in requirements (it is recommended to have it there)
RUN pip install --no-cache-dir jupyter notebook jupyter-server-proxy

# Copy Source Code
COPY . .

# Copy and setup entrypoint script
COPY start-jupyter.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-jupyter.sh

# Create mount point and config directories
RUN mkdir -p /app/jupyter_notebooks /app/public/uploads

# Expose Ports
EXPOSE 8888

# Set Entrypoint to our script
ENTRYPOINT ["/usr/local/bin/start-jupyter.sh"]

# Default Command
CMD ["jupyter", "notebook", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root", "--NotebookApp.token=''", "--NotebookApp.password=''", "--notebook-dir=/app/jupyter_notebooks", "--NotebookApp.base_url=/jupyter", "--NotebookApp.trust_xheaders=True"]
