import { defineConfig } from "vitest/config";

// Testes de integração: falam com o Floci e o Kokoro de verdade.
// Rodam dentro do container: docker compose run --rm worker npm run test:integracao
export default defineConfig({
  test: {
    include: ["test/**/*.integracao.test.ts"],
    testTimeout: 90_000,
    fileParallelism: false,
  },
});
