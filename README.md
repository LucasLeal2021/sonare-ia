# sonare-ia

O worker da Sonare: lê a fila de Gerações, cria a Narração (Kokoro + ffmpeg) ou a Imagem (Cloudflare Workers AI) e avisa a API pelo EventBridge.

A rotina para subir tudo, o setup inicial e a documentação do projeto estão no [`sonare-api`](https://github.com/LucasLeal2021/sonare-api) (`README.md` e `docs/`).

```bash
docker compose up                                     # o worker, na rede do Floci
npm test                                              # testes rápidos
docker compose run --rm worker npm run test:integracao  # Floci, Kokoro e Cloudflare reais
```

O `.env` (fora do git; veja o `.env.example`) guarda a chave da Cloudflare, que o setup copia para o Secrets Manager.
