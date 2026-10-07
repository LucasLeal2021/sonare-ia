import { describe, expect, it } from "vitest";
import { processarMensagem } from "../src/processarMensagem";
import { AUDIO_FALSO, criarFakes } from "./fakes";

const narracaoValida = {
  versao: 1,
  criacaoId: "c-123",
  tipo: "narracao",
  texto: "Olá! Eu sou uma voz da Sonare.",
  voz: "pf_dora",
};

const mensagem = (corpo: object, tentativa = 1) => ({ corpo: JSON.stringify(corpo), tentativa });

describe("processarMensagem", () => {
  it("uma Narração válida vira um Áudio salvo e um aviso de CriacaoConcluida", async () => {
    const fakes = criarFakes();

    const resultado = await processarMensagem(mensagem(narracaoValida), fakes);

    expect(resultado).toEqual({ tipo: "concluida" });
    expect(fakes.armazenamento.ler("narracoes/c-123.mp3")).toEqual(AUDIO_FALSO);
    expect(fakes.eventos.publicados).toEqual([
      { tipo: "CriacaoConcluida", criacaoId: "c-123", chaveAudio: "narracoes/c-123.mp3" },
    ]);
  });

  it("se a Geração falha antes da última Tentativa, a mensagem fica na fila para tentar de novo, sem avisar ninguém", async () => {
    const fakes = criarFakes({ geracaoFalha: true });

    const resultado = await processarMensagem(mensagem(narracaoValida, 2), fakes);

    expect(resultado).toEqual({ tipo: "tentar-de-novo", motivo: "Kokoro saiu com código 1" });
    expect(fakes.armazenamento.ler("narracoes/c-123.mp3")).toBeUndefined();
    expect(fakes.eventos.publicados).toEqual([]);
  });

  it("se a Geração falha na terceira Tentativa, avisa CriacaoFalhou e deixa a mensagem seguir para a DLQ", async () => {
    const fakes = criarFakes({ geracaoFalha: true });

    const resultado = await processarMensagem(mensagem(narracaoValida, 3), fakes);

    expect(resultado).toEqual({ tipo: "falhou", motivo: "Kokoro saiu com código 1" });
    expect(fakes.eventos.publicados).toEqual([
      { tipo: "CriacaoFalhou", criacaoId: "c-123", motivo: "Kokoro saiu com código 1" },
    ]);
  });

  it.each([
    ["versão desconhecida", JSON.stringify({ ...narracaoValida, versao: 2 }), "versão de mensagem não suportada: 2"],
    ["sem Texto", JSON.stringify({ ...narracaoValida, texto: "  " }), "Texto vazio"],
    ["Texto longo demais", JSON.stringify({ ...narracaoValida, texto: "a".repeat(1001) }), "Texto com mais de 1.000 caracteres"],
    ["Voz desconhecida", JSON.stringify({ ...narracaoValida, voz: "pm_joao" }), "Voz desconhecida: pm_joao"],
    ["corpo que não é JSON", "isto não é JSON", "mensagem não é um JSON válido"],
  ])("mensagem inválida (%s) é recusada sem gerar nada", async (_caso, corpo, motivo) => {
    const fakes = criarFakes();

    const resultado = await processarMensagem({ corpo, tentativa: 1 }, fakes);

    expect(resultado).toEqual({ tipo: "tentar-de-novo", motivo });
    expect(fakes.pedidosDeNarracao).toEqual([]);
  });
});
