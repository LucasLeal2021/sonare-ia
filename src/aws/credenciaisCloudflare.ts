import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { Config } from "../config";
import type { CredenciaisCloudflare } from "../geradores/geradorCloudflare";

/** Lê a chave da Cloudflare no Secrets Manager (colocada lá à mão, fora do Terraform). */
export async function buscarCredenciaisCloudflare(config: Config): Promise<CredenciaisCloudflare> {
  if (!config.cloudflareSegredo) throw new Error("Cloudflare não configurada: falta o parâmetro cloudflare/segredo no SSM");
  try {
    const { SecretString } = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: config.cloudflareSegredo }));
    return JSON.parse(SecretString!);
  } catch (erro) {
    throw new Error(`Cloudflare não configurada: o segredo ${config.cloudflareSegredo} está vazio? (${(erro as Error).message})`);
  }
}
