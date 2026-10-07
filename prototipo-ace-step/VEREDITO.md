# PROTÓTIPO DESCARTÁVEL — veredito (2026-10-07)

**Pergunta:** o Space do ACE-Step no Hugging Face consegue gerar ~30 s de música com voz cantada em PT-BR, de graça, para a Sonare?

**Resposta: não.** A cota gratuita de ZeroGPU cobre cerca de uma Geração por dia.

## O que foi observado

- Spaces oficiais `ACE-Step/Ace-Step-v1.5` e `ACE-Step/ACE-Step` estavam RUNNING (ZeroGPU A10G). O v1.5 aceita `Vocal Language = pt`.
- `@gradio/client` 1.19 travou em silêncio contra o Gradio 6.2 do Space v1.5 (18 min sem nenhum evento).
- Chamadas HTTP diretas (`/gradio_api/call/...`) a endpoints com GPU devolviam `event: error / data: null` em ~0,2 s, com ou sem token, mesmo com os parâmetros do exemplo oficial. Endpoints sem GPU funcionavam.
- No site, logado, a mensagem real apareceu: _"You have exceeded your free ZeroGPU quota (60s requested vs. 84s left)"_ — cada pedido reserva 60 s de GPU.
- Armadilhas descobertas: defaults `null` publicados na API quebram o Space (o exemplo usa strings); no Git Bash do Windows, JSON com caracteres não-ASCII em `-d` é corrompido — usar `--data-binary @arquivo`.

## Decisão resultante

O produto mudou para Narração (Piper local) + Imagem (Cloudflare Workers AI). Ver ADR 0005 (substituída) e ADR 0011 no `sonare-api`.
