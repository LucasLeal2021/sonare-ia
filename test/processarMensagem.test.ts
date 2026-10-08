import { describe, expect, it } from "vitest";
import { processarMensagem } from "../src/processarMensagem";
import { AUDIO_FALSO, criarFakes, IMAGEM_FALSA, PROMPT_FALSO } from "./fakes";

const narracaoValida = {
  versao: 1,
  criacaoId: "c-123",
  tipo: "narracao",
  texto: "Olá! Eu sou uma voz da Sonare.",
  voz: "pf_dora",
};

const imagemValida = {
  versao: 1,
  criacaoId: "c-456",
  tipo: "imagem",
  descricao: "um farol solitário numa falésia ao entardecer",
};

const mensagem = (corpo: object, tentativa = 1) => ({ corpo: JSON.stringify(corpo), tentativa });

describe("processarMensagem: Narração", () => {
  it("uma Narração válida vira um Áudio salvo e um aviso de CriacaoConcluida", async () => {
    const fakes = criarFakes();

    const resultado = await processarMensagem(mensagem(narracaoValida), fakes);

    expect(resultado).toEqual({ tipo: "concluida" });
    expect(fakes.armazenamento.ler("narracoes/c-123.mp3")).toEqual(AUDIO_FALSO);
    expect(fakes.armazenamento.tipoDe("narracoes/c-123.mp3")).toBe("audio/mpeg");
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
});

describe("processarMensagem: Imagem", () => {
  it("uma Imagem válida vira um JPG salvo e um aviso de CriacaoConcluida com o Prompt usado", async () => {
    const fakes = criarFakes();

    const resultado = await processarMensagem(mensagem(imagemValida), fakes);

    expect(resultado).toEqual({ tipo: "concluida" });
    expect(fakes.pedidosDeImagem).toEqual([{ descricao: imagemValida.descricao }]);
    expect(fakes.armazenamento.ler("imagens/c-456.jpg")).toEqual(IMAGEM_FALSA);
    expect(fakes.armazenamento.tipoDe("imagens/c-456.jpg")).toBe("image/jpeg");
    expect(fakes.eventos.publicados).toEqual([
      { tipo: "CriacaoConcluida", criacaoId: "c-456", chaveImagem: "imagens/c-456.jpg", prompt: PROMPT_FALSO },
    ]);
  });

  it("se a Geração da Imagem falha na terceira Tentativa, avisa CriacaoFalhou", async () => {
    const fakes = criarFakes({ geracaoFalha: true });

    const resultado = await processarMensagem(mensagem(imagemValida, 3), fakes);

    expect(resultado).toEqual({ tipo: "falhou", motivo: "Cloudflare respondeu 429" });
    expect(fakes.eventos.publicados).toEqual([
      { tipo: "CriacaoFalhou", criacaoId: "c-456", motivo: "Cloudflare respondeu 429" },
    ]);
  });
});

describe("processarMensagem: recusas definitivas", () => {
  it("uma recusa que nunca vai dar certo (ex.: filtro de conteúdo) avisa CriacaoFalhou já na 1ª Tentativa e sai da fila", async () => {
    const fakes = criarFakes({ recusa: "A Cloudflare recusou esta Descrição pelo filtro de conteúdo." });

    const resultado = await processarMensagem(mensagem(imagemValida, 1), fakes);

    expect(resultado).toEqual({ tipo: "recusada", motivo: "A Cloudflare recusou esta Descrição pelo filtro de conteúdo." });
    expect(fakes.eventos.publicados).toEqual([
      {
        tipo: "CriacaoFalhou",
        criacaoId: "c-456",
        motivo: "A Cloudflare recusou esta Descrição pelo filtro de conteúdo.",
        definitiva: true,
      },
    ]);
  });
});

describe("processarMensagem: mensagens inválidas", () => {
  it.each([
    ["versão desconhecida", JSON.stringify({ ...narracaoValida, versao: 2 }), "versão de mensagem não suportada: 2"],
    ["tipo desconhecido", JSON.stringify({ ...narracaoValida, tipo: "video" }), "tipo de Criação desconhecido: video"],
    ["sem Texto", JSON.stringify({ ...narracaoValida, texto: "  " }), "Texto vazio"],
    ["Texto longo demais", JSON.stringify({ ...narracaoValida, texto: "a".repeat(1001) }), "Texto com mais de 1.000 caracteres"],
    ["Voz desconhecida", JSON.stringify({ ...narracaoValida, voz: "pm_joao" }), "Voz desconhecida: pm_joao"],
    ["sem Descrição", JSON.stringify({ ...imagemValida, descricao: " " }), "Descrição vazia"],
    ["Descrição longa demais", JSON.stringify({ ...imagemValida, descricao: "a".repeat(501) }), "Descrição com mais de 500 caracteres"],
    ["corpo que não é JSON", "isto não é JSON", "mensagem não é um JSON válido"],
  ])("mensagem inválida (%s) é recusada sem gerar nada", async (_caso, corpo, motivo) => {
    const fakes = criarFakes();

    const resultado = await processarMensagem({ corpo, tentativa: 1 }, fakes);

    expect(resultado).toEqual({ tipo: "tentar-de-novo", motivo });
    expect(fakes.pedidosDeNarracao).toEqual([]);
    expect(fakes.pedidosDeImagem).toEqual([]);
  });
});
