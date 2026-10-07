// PROTÓTIPO DESCARTÁVEL — chama a API HTTP do Space direto, sem @gradio/client
// (a biblioteca travou em silêncio com o Gradio 6.2 deste Space).
// Uso: npm run gerar-http -- <cenario>    (cenarios: pt | en | instrumental)
import { mkdir, writeFile } from "node:fs/promises";

// v1.5 respondeu error:null (API interna da tela); o v1 expõe /__call__ simples.
const V1 = process.env.SPACE !== "v15";
const BASE = V1 ? "https://ace-step-ace-step.hf.space/gradio_api" : "https://ace-step-ace-step-v1-5.hf.space/gradio_api";
const ENDPOINT = V1 ? "__call__" : "generation_wrapper";

const LETRA = `[verse]
Acordei com o sol na janela
o café passando devagar
a cidade lá fora é tão bela
mas meu peito insiste em lembrar

[chorus]
Saudade, vem e senta aqui
conta o que ficou pra trás
saudade, eu aprendi a sorrir
mesmo quando a dor não se desfaz`;

const CENARIOS = {
  pt: { estilo: "samba acústico, violão de nylon e pandeiro, voz masculina suave, melancólico", letra: LETRA },
  en: { estilo: "acoustic samba, nylon guitar and pandeiro, soft male vocals, melancholic", letra: LETRA },
  instrumental: { estilo: "samba acústico, violão de nylon e pandeiro, melancólico", letra: "[Instrumental]" },
} as const;

const nome = (process.argv[2] ?? "pt") as keyof typeof CENARIOS;
const cenario = CENARIOS[nome];
if (!cenario) throw new Error(`cenário desconhecido: ${nome}`);

const token = process.env.HF_TOKEN;
const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
const log = (m: string) => console.log(`[${seg()}] ${m}`);

// 1. Monta os 49 parâmetros na ordem certa, com os valores padrão do próprio Space
const info = await (await fetch(`${BASE}/info`)).json();
const params: { parameter_name: string; parameter_default: unknown }[] = info.named_endpoints[`/${ENDPOINT}`].parameters;
const nossos: Record<string, unknown> = V1
  ? {
      audio_duration: 30,
      prompt: cenario.estilo,
      lyrics: cenario.letra,
      // os "defaults" publicados são null, mas o Space quebra com null: o exemplo oficial usa strings
      manual_seeds: String(Math.floor(Math.random() * 1_000_000)),
      oss_steps: "",
    }
  : {
  generation_mode: "custom",
  simple_query_input: "",
  param_4: cenario.estilo, // Prompt (= nosso Estilo)
  param_5: cenario.letra, // Lyrics
  param_9: "pt", // Vocal Language
  param_15: 30, // Audio Duration (s)
  param_16: 1, // batch size
  param_18: "", // Audio Codes
  param_30: "mp3", // Audio Format
};
const data = params.map((p) => (p.parameter_name in nossos ? nossos[p.parameter_name] : p.parameter_default));
log(`cenário "${nome}" — ${data.length} parâmetros montados`);

// 2. Entra na fila
const r1 = await fetch(`${BASE}/call/${ENDPOINT}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...auth },
  body: JSON.stringify({ data }),
});
const corpo1 = await r1.text();
log(`POST /call → HTTP ${r1.status}: ${corpo1.slice(0, 300)}`);
if (!r1.ok) process.exit(1);
const { event_id } = JSON.parse(corpo1);

// 3. Acompanha o stream de eventos (SSE)
const r2 = await fetch(`${BASE}/call/${ENDPOINT}/${event_id}`, { headers: auth, signal: AbortSignal.timeout(15 * 60_000) });
log(`GET stream → HTTP ${r2.status}`);
const batimento = setInterval(() => log("... aguardando"), 30_000);
const decoder = new TextDecoder();
let buffer = "";
let evento = "";
let resultado: unknown[] | undefined;
for await (const chunk of r2.body!) {
  buffer += decoder.decode(chunk, { stream: true });
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const linha = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!linha) continue;
    if (linha.startsWith("event:")) evento = linha.slice(6).trim();
    if (linha.startsWith("data:")) {
      const dado = linha.slice(5).trim();
      if (evento !== "heartbeat") log(`evento ${evento}: ${dado.slice(0, 300)}`);
      if (evento === "complete") resultado = JSON.parse(dado);
      if (evento === "error") process.exit(1);
    }
  }
}
clearInterval(batimento);
if (!resultado) throw new Error("stream terminou sem resultado");

// 4. Baixa o Áudio
const amostra = resultado[0] as { url?: string } | null;
console.log(`\nDetalhes: ${JSON.stringify(V1 ? resultado[1] : resultado[9]).slice(0, 800)}\n`);
if (!amostra?.url) throw new Error("sem arquivo de áudio na resposta");
const r3 = await fetch(amostra.url, { headers: auth });
const buf = Buffer.from(await r3.arrayBuffer());
const ext = (amostra.url.split("?")[0].split(".").pop() || "bin").toLowerCase();
await mkdir("saida", { recursive: true });
await writeFile(`saida/${nome}.${ext}`, buf);
log(`✔ áudio salvo em prototipo-ace-step/saida/${nome}.${ext} (${(buf.length / 1024).toFixed(0)} KB, ${r3.headers.get("content-type")})`);
process.exit(0);
