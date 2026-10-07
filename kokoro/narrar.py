"""Narra um Texto com o Kokoro e grava um WAV. Chamado pelo worker como ferramenta de linha de comando.

Uso: python narrar.py --voz pf_dora --entrada texto.txt --saida audio.wav
"""
import argparse
import os

import soundfile as sf
from kokoro_onnx import Kokoro

parser = argparse.ArgumentParser()
parser.add_argument("--voz", required=True)
parser.add_argument("--entrada", required=True, help="arquivo UTF-8 com o Texto")
parser.add_argument("--saida", required=True, help="caminho do WAV a gerar")
args = parser.parse_args()

modelo = os.environ.get("KOKORO_MODELO_DIR", "/opt/kokoro/modelo")
kokoro = Kokoro(f"{modelo}/kokoro-v1.0.onnx", f"{modelo}/voices-v1.0.bin")

with open(args.entrada, encoding="utf-8") as arquivo:
    texto = arquivo.read()

amostras, taxa = kokoro.create(texto, voice=args.voz, speed=1.0, lang="pt-br")
sf.write(args.saida, amostras, taxa)
