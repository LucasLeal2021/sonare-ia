// As fronteiras do worker com o mundo de fora. Cada uma tem uma implementação real
// (Kokoro, Cloudflare, S3, EventBridge) e uma falsa para os testes.

export interface GeradorDeNarracao {
  /** Devolve o Áudio da Narração em MP3. */
  gerar(pedido: { texto: string; voz: string }): Promise<Uint8Array>;
}

export interface GeradorDeImagem {
  /** Devolve a Imagem em JPEG e o Prompt (em inglês) que de fato foi enviado ao modelo. */
  gerar(pedido: { descricao: string }): Promise<{ imagem: Uint8Array; prompt: string }>;
}

export interface ArmazenamentoDeArquivos {
  salvar(chave: string, conteudo: Uint8Array, tipoConteudo: string): Promise<void>;
}

/**
 * Uma falha que NUNCA vai dar certo numa nova Tentativa (ex.: o filtro de conteúdo recusou a Descrição).
 * A mensagem é para o Artista ler. Qualquer outro erro é tratado como passageiro (ADR 0012).
 */
export class FalhaDefinitiva extends Error {
  override name = "FalhaDefinitiva";
}

export type EventoDeCriacao =
  | { tipo: "CriacaoConcluida"; criacaoId: string; chaveAudio: string }
  | { tipo: "CriacaoConcluida"; criacaoId: string; chaveImagem: string; prompt: string }
  | { tipo: "CriacaoFalhou"; criacaoId: string; motivo: string; definitiva?: true };

export interface PublicadorDeEventos {
  publicar(evento: EventoDeCriacao): Promise<void>;
}
