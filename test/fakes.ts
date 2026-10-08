// Versões falsas das fronteiras do worker (Kokoro, Cloudflare, S3, EventBridge), para os testes.
import {
  FalhaDefinitiva,
  type ArmazenamentoDeArquivos,
  type EventoDeCriacao,
  type GeradorDeImagem,
  type GeradorDeNarracao,
  type PublicadorDeEventos,
} from "../src/portas";

export const AUDIO_FALSO = new Uint8Array([0x49, 0x44, 0x33, 0x04]); // "ID3": começo de um MP3
export const IMAGEM_FALSA = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // começo de um JPEG
export const PROMPT_FALSO = "a lonely lighthouse on a cliff";

export function criarFakes(opcoes: { geracaoFalha?: boolean; recusa?: string } = {}) {
  const arquivos = new Map<string, { conteudo: Uint8Array; tipoConteudo: string }>();
  const publicados: EventoDeCriacao[] = [];
  const pedidosDeNarracao: { texto: string; voz: string }[] = [];
  const pedidosDeImagem: { descricao: string }[] = [];

  const geradorDeNarracao: GeradorDeNarracao = {
    async gerar(pedido) {
      pedidosDeNarracao.push(pedido);
      if (opcoes.geracaoFalha) throw new Error("Kokoro saiu com código 1");
      return AUDIO_FALSO;
    },
  };

  const geradorDeImagem: GeradorDeImagem = {
    async gerar(pedido) {
      pedidosDeImagem.push(pedido);
      if (opcoes.recusa) throw new FalhaDefinitiva(opcoes.recusa);
      if (opcoes.geracaoFalha) throw new Error("Cloudflare respondeu 429");
      return { imagem: IMAGEM_FALSA, prompt: PROMPT_FALSO };
    },
  };

  const armazenamento: ArmazenamentoDeArquivos & {
    ler(chave: string): Uint8Array | undefined;
    tipoDe(chave: string): string | undefined;
  } = {
    async salvar(chave, conteudo, tipoConteudo) {
      arquivos.set(chave, { conteudo, tipoConteudo });
    },
    ler: (chave) => arquivos.get(chave)?.conteudo,
    tipoDe: (chave) => arquivos.get(chave)?.tipoConteudo,
  };

  const eventos: PublicadorDeEventos & { publicados: EventoDeCriacao[] } = {
    async publicar(evento) {
      publicados.push(evento);
    },
    publicados,
  };

  return { geradorDeNarracao, geradorDeImagem, armazenamento, eventos, pedidosDeNarracao, pedidosDeImagem };
}
