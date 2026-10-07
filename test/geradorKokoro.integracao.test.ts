// Integração com o Kokoro + ffmpeg instalados na imagem do worker.
import { describe, expect, it } from "vitest";
import { criarGeradorKokoro } from "../src/geradores/geradorKokoro";

describe("GeradorKokoro", () => {
  it("transforma um Texto curto num MP3 com a Voz pedida", async () => {
    const audio = await criarGeradorKokoro().gerar({ texto: "Olá! Eu sou uma voz da Sonare.", voz: "pf_dora" });

    const cabecalho = new TextDecoder().decode(audio.slice(0, 3));
    expect(cabecalho).toBe("ID3"); // o ffmpeg grava MP3 com uma etiqueta ID3 no começo
    expect(audio.length).toBeGreaterThan(10_000); // ~2 s de fala a 64 kbps passa fácil disso
  });
});
