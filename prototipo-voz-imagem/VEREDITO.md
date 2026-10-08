# PROTÓTIPO DESCARTÁVEL — veredito (2026-10-07)

**Perguntas:** (1) dá para gerar Narração em PT-BR de qualidade, de graça, na CPU da EC2 do worker? (2) a Cloudflare Workers AI gera Imagens boas a partir de uma Descrição em português?

## Narração

Ambiente: container `python:3.12-slim` com ffmpeg, Ryzen 7 5700G (16 threads), sem GPU.

| Motor | Vozes PT-BR | Velocidade | Veredito do autor (ouvindo) |
|---|---|---|---|
| Piper 1.8.0 | cadu, faber, jeff (medium), edresson (low) — **todas masculinas** | ~9× tempo real (727 caracteres → 39 s de Áudio em 4,3 s) | ❌ Reprovado: sotaque americano (as vozes são *finetuned* de uma voz em inglês); edresson "horrível" |
| Kokoro-82M (`kokoro-onnx` 0.6.1, modelo fp32 325 MB) | **pf_dora (feminina)**, pm_alex, pm_santa | ~2,3× tempo real (727 caracteres → 40 s de Áudio em 17,5 s); modelo carrega em 1,2 s | ✅ **Aprovado**: "bem melhores" |

MP3 64 kbps via ffmpeg fica ~5× menor que o WAV (~8 KB por segundo de Áudio).

## Imagem

FLUX.1 schnell (`@cf/black-forest-labs/flux-1-schnell`, 4 steps): 1024×1024 JPEG, ~500 KB, 2–5 s.

- Descrição em **português** direto: ignorou "falésia" e "aquarela".
- Mesma Descrição em **inglês**: acertou tudo.
- Descrição em português **traduzida** pelo `@cf/meta/m2m100-1.2b` (3,8 s): acertou falésia, aquarela e tons; tradução imperfeita ("aquarel style") mas suficiente.

## Decisões resultantes

- Narração com Kokoro; vozes dora (padrão), alex e santa, cada uma com amostra curta.
- Imagem com FLUX.1 schnell; o worker traduz a Descrição com m2m100 para montar o Prompt.
- Ver ADR 0011 no `sonare-api`.
