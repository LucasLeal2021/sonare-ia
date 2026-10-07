import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

export type Config = {
  bucketCriacoes: string;
  filaGeracoesUrl: string;
  filaCriacoesConcluidasUrl: string;
  barramentoEventos: string;
};

/** Lê no SSM Parameter Store o que a base do Terraform publicou (ADR 0008). */
export async function carregarConfig(ambiente = process.env.AMBIENTE ?? "local"): Promise<Config> {
  const caminho = `/sonare/${ambiente}/`;
  const { Parameters = [] } = await new SSMClient({}).send(
    new GetParametersByPathCommand({ Path: caminho, Recursive: true }),
  );
  const ler = (nome: string) => {
    const valor = Parameters.find((p) => p.Name === caminho + nome)?.Value;
    if (!valor) throw new Error(`parâmetro ${caminho + nome} não encontrado — o Terraform base foi aplicado?`);
    return valor;
  };

  return {
    bucketCriacoes: ler("s3/bucket-criacoes"),
    filaGeracoesUrl: ler("sqs/geracoes-url"),
    filaCriacoesConcluidasUrl: ler("sqs/criacoes-concluidas-url"),
    barramentoEventos: ler("eventbridge/barramento"),
  };
}
