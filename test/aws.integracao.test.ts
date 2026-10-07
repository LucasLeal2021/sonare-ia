// Integração com o Floci: rodar dentro do container (npm run test:integracao).
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { criarArmazenamentoS3 } from "../src/aws/armazenamentoS3";
import { criarPublicadorEventBridge } from "../src/aws/publicadorEventBridge";
import { carregarConfig, type Config } from "../src/config";
import { esperarEventoNaFilaDaApi } from "./apoioIntegracao";

const AUDIO = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x2a]);

let config: Config;
beforeAll(async () => {
  config = await carregarConfig();
});

describe("adaptadores da AWS (Floci)", () => {
  it("o Áudio salvo no S3 pode ser lido de volta pelo mesmo caminho", async () => {
    const chave = `testes/${randomUUID()}.mp3`;

    await criarArmazenamentoS3(config).salvar(chave, AUDIO);

    const s3 = new S3Client({ forcePathStyle: true });
    const objeto = await s3.send(new GetObjectCommand({ Bucket: config.bucketCriacoes, Key: chave }));
    expect(await objeto.Body!.transformToByteArray()).toEqual(AUDIO);
  });

  it("um aviso de CriacaoConcluida publicado no EventBridge chega na fila da API", async () => {
    const criacaoId = `teste-${randomUUID()}`;

    await criarPublicadorEventBridge(config).publicar({ tipo: "CriacaoConcluida", criacaoId, chaveAudio: "narracoes/x.mp3" });

    const evento = await esperarEventoNaFilaDaApi(config, criacaoId);
    expect(evento["detail-type"]).toBe("CriacaoConcluida");
    expect(evento.detail).toEqual({ criacaoId, chaveAudio: "narracoes/x.mp3" });
  });
});
