import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { GeradorDeNarracao } from "../portas";

const executar = promisify(execFile);
const SCRIPT_NARRAR = fileURLToPath(new URL("../../kokoro/narrar.py", import.meta.url));

/** Narração com o Kokoro (Python, chamado como ferramenta de linha de comando) + ffmpeg (WAV → MP3). ADR 0011. */
export function criarGeradorKokoro(python = process.env.KOKORO_PYTHON ?? "python3"): GeradorDeNarracao {
  return {
    async gerar({ texto, voz }) {
      const pasta = await mkdtemp(join(tmpdir(), "narracao-"));
      const [entrada, wav, mp3] = ["texto.txt", "audio.wav", "audio.mp3"].map((nome) => join(pasta, nome));
      try {
        await writeFile(entrada, texto, "utf-8");
        await rodar("Kokoro", python, [SCRIPT_NARRAR, "--voz", voz, "--entrada", entrada, "--saida", wav]);
        await rodar("ffmpeg", "ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "64k", mp3]);
        return new Uint8Array(await readFile(mp3));
      } finally {
        await rm(pasta, { recursive: true, force: true });
      }
    },
  };
}

async function rodar(nome: string, programa: string, argumentos: string[]) {
  try {
    await executar(programa, argumentos);
  } catch (erro) {
    const saida = String((erro as { stderr?: string }).stderr ?? "").trim().split("\n").pop();
    throw new Error(`${nome} falhou: ${saida || (erro as Error).message}`);
  }
}
