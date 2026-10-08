// O GeradorCloudflare decide se uma resposta ruim da Cloudflare vale nova Tentativa ou não.
// A Cloudflare aqui é falsa (fetch substituído): nada de rede, nada de cota gasta.
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarGeradorCloudflare } from "../src/geradores/geradorCloudflare";
import { FalhaDefinitiva } from "../src/portas";

const credenciais = async () => ({ accountId: "conta", token: "token" });

function cloudflareResponde(status: number, mensagem: string) {
  vi.stubGlobal("fetch", async () => Response.json({ success: false, errors: [{ message: mensagem }] }, { status }));
}

afterEach(() => vi.unstubAllGlobals());

describe("GeradorCloudflare: classificação das recusas", () => {
  it("o filtro de conteúdo (400 NSFW) é uma recusa definitiva, com mensagem para o Artista", async () => {
    cloudflareResponde(400, "AiError: AiError: Input prompt contains NSFW content. (abc)");

    const tentativa = criarGeradorCloudflare(credenciais).gerar({ descricao: "algo proibido" });

    await expect(tentativa).rejects.toBeInstanceOf(FalhaDefinitiva);
    await expect(tentativa).rejects.toThrow("A Cloudflare recusou esta Descrição pelo filtro de conteúdo. Tente descrever de outro jeito.");
  });

  it.each([
    [429, "limite de uso: vale tentar de novo depois"],
    [500, "erro do lado da Cloudflare: vale tentar de novo"],
  ])("um %i é passageiro (%s)", async (status) => {
    cloudflareResponde(status, "algo deu errado");

    const tentativa = criarGeradorCloudflare(credenciais).gerar({ descricao: "um farol" });

    await expect(tentativa).rejects.toThrow(`respondeu ${status}`);
    await expect(tentativa).rejects.not.toBeInstanceOf(FalhaDefinitiva);
  });
});
