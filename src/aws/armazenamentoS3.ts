import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config";
import type { ArmazenamentoDeAudio } from "../portas";

export function criarArmazenamentoS3(config: Config): ArmazenamentoDeAudio {
  // Fora da AWS real (Floci), o bucket vai no caminho da URL e não no nome do host
  const s3 = new S3Client({ forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL) });

  return {
    async salvar(chave, audio) {
      await s3.send(
        new PutObjectCommand({ Bucket: config.bucketCriacoes, Key: chave, Body: audio, ContentType: "audio/mpeg" }),
      );
    },
  };
}
