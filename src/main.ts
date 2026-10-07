import { carregarConfig } from "./config";
import { criarWorker, log, processarProximasMensagens } from "./worker";

const config = await carregarConfig();
const worker = criarWorker(config);
log({ evento: "worker iniciado", fila: config.filaGeracoesUrl });

while (true) {
  try {
    await processarProximasMensagens(worker);
  } catch (erro) {
    // Ex.: Floci fora do ar. Espera um pouco e tenta de novo em vez de derrubar o worker.
    log({ evento: "erro no laço do worker", erro: (erro as Error).message });
    await new Promise((resolver) => setTimeout(resolver, 5_000));
  }
}
