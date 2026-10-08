import { FalhaDefinitiva, type GeradorDeImagem } from "../portas";

export type CredenciaisCloudflare = { accountId: string; token: string };

const TRADUTOR = "@cf/meta/m2m100-1.2b";
const MODELO_DE_IMAGEM = "@cf/black-forest-labs/flux-1-schnell";

/**
 * Imagem com a Cloudflare Workers AI (ADR 0011): a Descrição em português vira um Prompt
 * em inglês (m2m100) e o FLUX.1 schnell gera a Imagem. As credenciais só são buscadas na
 * primeira Imagem: sem a chave configurada, as Narrações continuam funcionando.
 */
export function criarGeradorCloudflare(buscarCredenciais: () => Promise<CredenciaisCloudflare>): GeradorDeImagem {
  let credenciais: Promise<CredenciaisCloudflare> | undefined;

  async function rodar(modelo: string, corpo: object) {
    const { accountId, token } = await (credenciais ??= buscarCredenciais());
    const resposta = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelo}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok || !json.success) {
      const detalhe: string = json.errors?.[0]?.message ?? "sem detalhes";
      // 400 = a Cloudflare recusou ESTE pedido: repetir dá o mesmo resultado (ADR 0012).
      // 429 (limite de uso), 5xx e 401/403 (chave errada) são passageiros ou problemas do sistema:
      // seguem as Tentativas e, se não resolver, vão para a DLQ e disparam o alarme.
      if (resposta.status === 400 && /NSFW/i.test(detalhe)) {
        throw new FalhaDefinitiva("A Cloudflare recusou esta Descrição pelo filtro de conteúdo. Tente descrever de outro jeito.");
      }
      if (resposta.status === 400) throw new FalhaDefinitiva(`A Cloudflare recusou o pedido: ${detalhe}`);
      throw new Error(`Cloudflare (${modelo}) respondeu ${resposta.status}: ${detalhe}`);
    }
    return json.result;
  }

  return {
    async gerar({ descricao }) {
      const traducao = await rodar(TRADUTOR, { text: descricao, source_lang: "portuguese", target_lang: "english" });
      const prompt: string = traducao.translated_text;
      const resultado = await rodar(MODELO_DE_IMAGEM, { prompt, steps: 4 });
      return { imagem: new Uint8Array(Buffer.from(resultado.image, "base64")), prompt };
    },
  };
}
