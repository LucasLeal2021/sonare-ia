# PROTÓTIPO DESCARTÁVEL — narra os mesmos Textos do teste do Piper com as vozes PT-BR do Kokoro.
import os, subprocess, time
import soundfile as sf
from kokoro_onnx import Kokoro

TEXTO_CURTO = "Olá! Eu sou uma voz da Sonare. Do silêncio nasce a criação: escreva um texto, escolha uma voz, e eu leio para você."
TEXTO_LONGO = (
    "Era uma manhã de domingo em São Paulo, e a cidade ainda dormia. Nas calçadas da Avenida Paulista, apenas alguns "
    "ciclistas e um vendedor de café, que arrumava as garrafas térmicas com cuidado. Às sete e meia, o sol atravessou os "
    "prédios e iluminou a rua inteira. Você já parou para ouvir uma cidade acordar? Primeiro vêm os pássaros, depois os "
    "ônibus, e por fim as conversas. Naquele dia, porém, alguém decidiu fazer diferente: sentou num banco, abriu o caderno "
    "e escreveu a primeira frase de uma história que levaria três anos, quarenta e duas páginas e muitas xícaras de café "
    "para terminar. Esta é uma narração de teste com cerca de mil caracteres, para medir quanto tempo a Sonare leva para "
    "transformar um texto longo em voz."
)

os.makedirs("saida", exist_ok=True)
t = time.time()
kokoro = Kokoro("/modelo/kokoro-v1.0.onnx", "/modelo/voices-v1.0.bin")
print(f"modelo carregado em {time.time() - t:.1f}s (num worker isso acontece uma vez só) | CPUs: {os.cpu_count()}")
print("vozes PT-BR disponíveis:", [v for v in kokoro.get_voices() if v.startswith(("pf_", "pm_"))])
print()

def narrar(voz, rotulo, texto):
    wav, mp3 = f"saida/kokoro-{voz}-{rotulo}.wav", f"saida/kokoro-{voz}-{rotulo}.mp3"
    t0 = time.time()
    amostras, taxa = kokoro.create(texto, voice=voz, speed=1.0, lang="pt-br")
    t1 = time.time()
    sf.write(wav, amostras, taxa)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "64k", mp3], check=True)
    t2 = time.time()
    print(f"{voz:9} {rotulo:6} | Kokoro {t1 - t0:5.1f}s | ffmpeg {t2 - t1:4.1f}s | áudio {len(amostras) / taxa:5.1f}s "
          f"| MP3 {os.path.getsize(mp3) // 1024:4d} KB")

for voz in ("pf_dora", "pm_alex", "pm_santa"):
    narrar(voz, "curto", TEXTO_CURTO)
print()
narrar("pf_dora", "longo", TEXTO_LONGO)
