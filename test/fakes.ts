// Versões falsas das fronteiras do worker (Kokoro, S3, EventBridge), para os testes.
import type { ArmazenamentoDeAudio, EventoDeCriacao, GeradorDeNarracao, PublicadorDeEventos } from "../src/portas";

export const AUDIO_FALSO = new Uint8Array([0x49, 0x44, 0x33, 0x04]); // "ID3": começo de um MP3

export function criarFakes(opcoes: { geracaoFalha?: boolean } = {}) {
  const arquivos = new Map<string, Uint8Array>();
  const publicados: EventoDeCriacao[] = [];
  const pedidosDeNarracao: { texto: string; voz: string }[] = [];

  const gerador: GeradorDeNarracao = {
    async gerar(pedido) {
      pedidosDeNarracao.push(pedido);
      if (opcoes.geracaoFalha) throw new Error("Kokoro saiu com código 1");
      return AUDIO_FALSO;
    },
  };

  const armazenamento: ArmazenamentoDeAudio & { ler(chave: string): Uint8Array | undefined } = {
    async salvar(chave, audio) {
      arquivos.set(chave, audio);
    },
    ler: (chave) => arquivos.get(chave),
  };

  const eventos: PublicadorDeEventos & { publicados: EventoDeCriacao[] } = {
    async publicar(evento) {
      publicados.push(evento);
    },
    publicados,
  };

  return { gerador, armazenamento, eventos, pedidosDeNarracao };
}
