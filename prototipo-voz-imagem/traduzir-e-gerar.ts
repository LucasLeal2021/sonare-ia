// PROTÓTIPO DESCARTÁVEL — Descrição em PT → tradução m2m100 → Prompt em EN → FLUX.1 schnell.
// Uso: node --env-file=../.env traduzir-e-gerar.ts
import { writeFile } from "node:fs/promises";

const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run`;
const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };
const rodar = async (modelo: string, corpo: object) => {
  const t0 = Date.now();
  const r = await fetch(`${base}/${modelo}`, { method: "POST", headers, body: JSON.stringify(corpo) });
  const j: any = await r.json();
  if (!j.success) throw new Error(`${modelo}: ${JSON.stringify(j.errors)}`);
  return { result: j.result, seg: ((Date.now() - t0) / 1000).toFixed(1) };
};

const descricao = "um farol solitário numa falésia ao entardecer, mar calmo, estilo aquarela minimalista, tons suaves de azul e bege";

const traducao = await rodar("@cf/meta/m2m100-1.2b", { text: descricao, source_lang: "portuguese", target_lang: "english" });
const prompt: string = traducao.result.translated_text;
console.log(`Descrição: ${descricao}`);
console.log(`Prompt:    ${prompt}   (tradução em ${traducao.seg}s)`);

const imagem = await rodar("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
const buf = Buffer.from(imagem.result.image, "base64");
await writeFile("saida/imagem-pt-traduzida.jpg", buf);
console.log(`Imagem:    saida/imagem-pt-traduzida.jpg (${(buf.length / 1024).toFixed(0)} KB, ${imagem.seg}s)`);
