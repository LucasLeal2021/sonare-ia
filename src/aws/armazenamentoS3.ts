import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config";
import type { ArmazenamentoDeArquivos } from "../portas";

export function criarArmazenamentoS3(config: Config): ArmazenamentoDeArquivos {
  // Fora da AWS real (Floci), o bucket vai no caminho da URL e não no nome do host
  const s3 = new S3Client({ forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL) });

  return {
    // O ContentType faz o navegador tratar o arquivo certo (tocar o MP3, mostrar o JPG)
    async salvar(chave, conteudo, tipoConteudo) {
      await s3.send(new PutObjectCommand({ Bucket: config.bucketCriacoes, Key: chave, Body: conteudo, ContentType: tipoConteudo }));
    },
  };
}
