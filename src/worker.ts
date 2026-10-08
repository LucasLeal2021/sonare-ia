import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { criarArmazenamentoS3 } from "./aws/armazenamentoS3";
import { buscarCredenciaisCloudflare } from "./aws/credenciaisCloudflare";
import { criarGeradorCloudflare } from "./geradores/geradorCloudflare";
import { criarPublicadorEventBridge } from "./aws/publicadorEventBridge";
import type { Config } from "./config";
import { criarGeradorKokoro } from "./geradores/geradorKokoro";
import { processarMensagem } from "./processarMensagem";

export function criarWorker(config: Config) {
  return {
    sqs: new SQSClient({}),
    filaUrl: config.filaGeracoesUrl,
    deps: {
      geradorDeNarracao: criarGeradorKokoro(),
      geradorDeImagem: criarGeradorCloudflare(() => buscarCredenciaisCloudflare(config)),
      armazenamento: criarArmazenamentoS3(config),
      eventos: criarPublicadorEventBridge(config),
    },
  };
}

type Worker = ReturnType<typeof criarWorker>;

/**
 * Pega UMA mensagem da fila de Gerações (uma Geração por vez, Q7) e a processa.
 * Apaga a mensagem quando a Criação ficou pronta ou foi recusada de vez (não adianta repetir);
 * nos outros casos ela volta para a fila quando o visibility timeout acabar, e depois da
 * terceira entrega a SQS a manda para a DLQ.
 */
export async function processarProximasMensagens(worker: Worker, opcoes = { esperaSegundos: 20 }) {
  const { Messages = [] } = await worker.sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: worker.filaUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: opcoes.esperaSegundos,
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    }),
  );

  for (const m of Messages) {
    const tentativa = Number(m.Attributes?.ApproximateReceiveCount ?? 1);
    const inicio = Date.now();
    const resultado = await processarMensagem({ corpo: m.Body ?? "", tentativa }, worker.deps);

    log({ criacaoId: criacaoIdDe(m.Body), tentativa, ...resultado, duracaoMs: Date.now() - inicio });
    if (resultado.tipo === "concluida" || resultado.tipo === "recusada") {
      await worker.sqs.send(new DeleteMessageCommand({ QueueUrl: worker.filaUrl, ReceiptHandle: m.ReceiptHandle }));
    }
  }
}

// Logs em JSON, uma linha por evento, sempre com o criacaoId (Q23)
export function log(dados: Record<string, unknown>) {
  console.log(JSON.stringify({ hora: new Date().toISOString(), servico: "sonare-ia", ...dados }));
}

function criacaoIdDe(corpo?: string) {
  try {
    return JSON.parse(corpo ?? "").criacaoId;
  } catch {
    return undefined;
  }
}
