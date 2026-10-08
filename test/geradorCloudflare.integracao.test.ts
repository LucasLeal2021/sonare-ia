// Integração com a Cloudflare Workers AI de verdade (gasta alguns neurons da cota gratuita).
// Precisa da chave no Secrets Manager do Floci: veja infra/base/cloudflare.tf no sonare-api.
import { describe, expect, it } from "vitest";
import { buscarCredenciaisCloudflare } from "../src/aws/credenciaisCloudflare";
import { carregarConfig } from "../src/config";
import { criarGeradorCloudflare } from "../src/geradores/geradorCloudflare";

describe("GeradorCloudflare", () => {
  it("traduz a Descrição para um Prompt em inglês e devolve uma Imagem JPEG", async () => {
    const config = await carregarConfig();
    const gerador = criarGeradorCloudflare(() => buscarCredenciaisCloudflare(config));

    const { imagem, prompt } = await gerador.gerar({ descricao: "um gato dormindo ao sol, aquarela" });

    expect([imagem[0], imagem[1]]).toEqual([0xff, 0xd8]); // assinatura de um arquivo JPEG
    expect(imagem.length).toBeGreaterThan(50_000);
    expect(prompt.toLowerCase()).toContain("cat"); // "gato" traduzido
  });
});
