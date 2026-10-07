# Ambiente do worker: Node (o worker) + Python com Kokoro (a voz) + ffmpeg (WAV → MP3).
# Linux, como na futura EC2. Em desenvolvimento, o código é montado por cima de /app.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Kokoro num ambiente Python isolado, com o modelo e as vozes já baixados (~350 MB)
RUN python3 -m venv /opt/kokoro \
 && /opt/kokoro/bin/pip install --no-cache-dir kokoro-onnx soundfile
RUN mkdir -p /opt/kokoro/modelo && cd /opt/kokoro/modelo \
 && /opt/kokoro/bin/python -c "import urllib.request as u; b='https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'; [u.urlretrieve(b+f, f) for f in ('kokoro-v1.0.onnx','voices-v1.0.bin')]"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

ENV KOKORO_PYTHON=/opt/kokoro/bin/python \
    KOKORO_MODELO_DIR=/opt/kokoro/modelo
