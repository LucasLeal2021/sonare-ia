# PROTÓTIPO DESCARTÁVEL — Piper + ffmpeg + vozes PT-BR, como ficaria na EC2 do worker
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir piper-tts
WORKDIR /vozes
RUN python -m piper.download_voices pt_BR-cadu-medium pt_BR-edresson-low pt_BR-faber-medium pt_BR-jeff-medium && ls -la /vozes
WORKDIR /work
