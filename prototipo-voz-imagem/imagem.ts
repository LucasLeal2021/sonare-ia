// PROTÓTIPO DESCARTÁVEL — gera uma Imagem com FLUX.1 schnell na Cloudflare Workers AI.
// Uso: node --env-file=../.env imagem.ts
import { mkdir, writeFile } from "node:fs/promises";

const MODELO = "@cf/black-forest-labs/flux-1-schnell";
const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODELO}`;

const DESCRICOES = {
  pt: "um farol solitário numa falésia ao entardecer, mar calmo, estilo aquarela minimalista, tons suaves de azul e bege",
  en: "a lonely lighthouse on a cliff at dusk, calm sea, minimalist watercolor style, soft blue and beige tones",
};

await mkdir("saida", { recursive: true });
for (const [idioma, prompt] of Object.entries(DESCRICOES)) {
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4 }),
  });
  const json: any = await resp.json();
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  if (!json.success) {
    console.log(`${idioma}: HTTP ${resp.status} em ${seg}s — erros: ${JSON.stringify(json.errors)}`);
    continue;
  }
  const buf = Buffer.from(json.result.image, "base64");
  const ext = buf[0] === 0xff && buf[1] === 0xd8 ? "jpg" : buf[0] === 0x89 ? "png" : "bin";
  // dimensões de um JPEG: procurar o marcador SOF0/SOF2
  let dim = "?";
  for (let i = 2; ext === "jpg" && i < buf.length - 9; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      dim = `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`;
      break;
    }
  }
  const arquivo = `saida/imagem-${idioma}.${ext}`;
  await writeFile(arquivo, buf);
  console.log(`${idioma}: HTTP ${resp.status} em ${seg}s | ${dim} | ${(buf.length / 1024).toFixed(0)} KB → ${arquivo}`);
}
