FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install PyTorch CPU-only (much smaller, ~200MB vs ~2GB with CUDA)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.1.2 torchvision==0.16.2

# Install other Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy model file
COPY yolov8n.pt .

# Copy application code
COPY app.py .

# Run the application
CMD ["python", "app.py"]

