// O esqueleto andante do worker: fila real → Kokoro real → S3 real → EventBridge real, tudo no Floci.
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { carregarConfig, type Config } from "../src/config";
import { criarWorker, processarProximasMensagens } from "../src/worker";
import { esperarEventoNaFilaDaApi } from "./apoioIntegracao";

let config: Config;
beforeAll(async () => {
  config = await carregarConfig();
});

describe("worker de ponta a ponta", () => {
  it("uma Narração pedida na fila vira um MP3 no S3, um aviso na fila da API, e sai da fila de Gerações", async () => {
    const criacaoId = `e2e-${randomUUID()}`;
    const sqs = new SQSClient({});
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: config.filaGeracoesUrl,
        MessageBody: JSON.stringify({ versao: 1, criacaoId, tipo: "narracao", texto: "Teste de ponta a ponta.", voz: "pm_alex" }),
      }),
    );

    await processarProximasMensagens(criarWorker(config), { esperaSegundos: 1 });

    const s3 = new S3Client({ forcePathStyle: true });
    const objeto = await s3.send(new GetObjectCommand({ Bucket: config.bucketCriacoes, Key: `narracoes/${criacaoId}.mp3` }));
    const audio = await objeto.Body!.transformToByteArray();
    expect(new TextDecoder().decode(audio.slice(0, 3))).toBe("ID3");

    const evento = await esperarEventoNaFilaDaApi(config, criacaoId);
    expect(evento["detail-type"]).toBe("CriacaoConcluida");

    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: config.filaGeracoesUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }),
    );
    expect(Messages.filter((m) => m.Body?.includes(criacaoId))).toEqual([]);
  });
});
