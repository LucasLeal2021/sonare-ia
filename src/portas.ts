// As fronteiras do worker com o mundo de fora. Cada uma tem uma implementação real
// (Kokoro, S3, EventBridge) e uma falsa para os testes.

export interface GeradorDeNarracao {
  /** Devolve o Áudio da Narração em MP3. */
  gerar(pedido: { texto: string; voz: string }): Promise<Uint8Array>;
}

export interface ArmazenamentoDeAudio {
  salvar(chave: string, audio: Uint8Array): Promise<void>;
}

export type EventoDeCriacao =
  | { tipo: "CriacaoConcluida"; criacaoId: string; chaveAudio: string }
  | { tipo: "CriacaoFalhou"; criacaoId: string; motivo: string };

export interface PublicadorDeEventos {
  publicar(evento: EventoDeCriacao): Promise<void>;
}
