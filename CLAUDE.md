# sonare-ia (worker)

**Antes de qualquer tarefa, leia `../sonare-api/CLAUDE.md`**: modo de trabalho com o Lucas, regras, pegadinhas e onde ficam o glossário, o roteiro e as ADRs.

## Este repositório

O worker consome a fila de Gerações, gera a Narração (Kokoro + ffmpeg) ou a Imagem (Cloudflare: tradução m2m100 + FLUX), salva no S3 e publica `CriacaoConcluida` / `CriacaoFalhou` no EventBridge. Nunca escreve em banco (ADR 0004).

- O coração é `src/processarMensagem.ts`; as fronteiras estão em `src/portas.ts`, com versões falsas em `test/fakes.ts`. Testes rápidos ficam nesse seam.
- O Kokoro é Python, chamado como ferramenta de linha de comando (`kokoro/narrar.py`), como o ffmpeg (ADR 0011).
- Falha passageira → até 3 Tentativas e DLQ; `FalhaDefinitiva` → avisa na hora e sai da fila (ADR 0012). `TENTATIVAS_MAXIMAS` precisa ser igual ao `maxReceiveCount` em `sonare-api/infra/base/filas.tf`.
- Roda em container na rede `sonare-net` (Python, Kokoro e ffmpeg estão na imagem). Testes de integração: `docker compose run --rm worker npm run test:integracao` (o da Cloudflare gasta alguns neurons da cota gratuita).
