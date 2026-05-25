FROM python:3.11-slim

# Install OpenGL/GLES libs that MediaPipe needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgles2 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8765
EXPOSE 8765

CMD ["python", "server.py"]
