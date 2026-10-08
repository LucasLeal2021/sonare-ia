import { DeleteRuleCommand, EventBridgeClient, PutRuleCommand, PutTargetsCommand, RemoveTargetsCommand } from "@aws-sdk/client-eventbridge";
import { CreateQueueCommand, DeleteQueueCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import type { Config } from "../src/config";

const sqs = new SQSClient({});
const eventbridge = new EventBridgeClient({});

/** Uma fila só do teste (na fila real, o worker ou a API ligados pegariam a mensagem primeiro). */
export async function criarFilaTemporaria() {
  const { QueueUrl } = await sqs.send(new CreateQueueCommand({ QueueName: `sonare-teste-${randomUUID()}` }));
  return { url: QueueUrl!, apagar: () => sqs.send(new DeleteQueueCommand({ QueueUrl })) };
}

/**
 * Escuta os avisos do worker numa fila só do teste: uma regra temporária no barramento entrega
 * os eventos nela, além da fila da API. Assim o teste não disputa eventos com a API ligada.
 */
export async function criarOuvinteDeAvisos(config: Config) {
  const fila = await criarFilaTemporaria();
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: fila.url, AttributeNames: ["QueueArn"] }));
  const regra = `sonare-teste-${randomUUID()}`.slice(0, 64);
  await eventbridge.send(
    new PutRuleCommand({ Name: regra, EventBusName: config.barramentoEventos, EventPattern: JSON.stringify({ source: ["sonare.ia"] }) }),
  );
  await eventbridge.send(
    new PutTargetsCommand({ Rule: regra, EventBusName: config.barramentoEventos, Targets: [{ Id: "teste", Arn: Attributes!.QueueArn }] }),
  );

  return {
    async esperarAviso(criacaoId: string) {
      for (let i = 0; i < 5; i++) {
        const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({ QueueUrl: fila.url, MaxNumberOfMessages: 10, WaitTimeSeconds: 2 }));
        const evento = Messages.map((m) => JSON.parse(m.Body!)).find((e) => e.detail?.criacaoId === criacaoId);
        if (evento) return evento;
      }
      throw new Error(`aviso de ${criacaoId} não chegou`);
    },
    async remover() {
      await eventbridge.send(new RemoveTargetsCommand({ Rule: regra, EventBusName: config.barramentoEventos, Ids: ["teste"] }));
      await eventbridge.send(new DeleteRuleCommand({ Name: regra, EventBusName: config.barramentoEventos }));
      await fila.apagar();
    },
  };
}
