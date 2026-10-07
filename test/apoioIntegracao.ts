import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { Config } from "../src/config";

/** Lê a fila da API até achar o evento desta Criação (outros testes podem ter deixado mensagens lá). */
export async function esperarEventoNaFilaDaApi(config: Config, criacaoId: string) {
  const sqs = new SQSClient({});
  for (let i = 0; i < 5; i++) {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: config.filaCriacoesConcluidasUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 2 }),
    );
    for (const m of Messages) {
      const evento = JSON.parse(m.Body!);
      if (evento.detail?.criacaoId !== criacaoId) continue;
      await sqs.send(new DeleteMessageCommand({ QueueUrl: config.filaCriacoesConcluidasUrl, ReceiptHandle: m.ReceiptHandle }));
      return evento;
    }
  }
  throw new Error(`evento de ${criacaoId} não chegou na fila da API`);
}
