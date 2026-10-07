// PROTÓTIPO DESCARTÁVEL — não é código de produção.
// Pergunta: o Space do ACE-Step v1.5 gera ~30s com voz cantada em PT-BR, de graça?
// Uso: npm run gerar -- <cenario>    (cenarios: pt | en | instrumental)
import { Client } from "@gradio/client";
import { mkdir, writeFile } from "node:fs/promises";

const SPACE = "ACE-Step/Ace-Step-v1.5";

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
  pt: {
    estilo: "samba acústico, violão de nylon e pandeiro, voz masculina suave, melancólico",
    letra: LETRA,
  },
  en: {
    estilo: "acoustic samba, nylon guitar and pandeiro, soft male vocals, melancholic",
    letra: LETRA,
  },
  instrumental: {
    estilo: "samba acústico, violão de nylon e pandeiro, melancólico",
    letra: "[Instrumental]",
  },
} as const;

const nome = (process.argv[2] ?? "pt") as keyof typeof CENARIOS;
const cenario = CENARIOS[nome];
if (!cenario) throw new Error(`cenário desconhecido: ${nome}. Use: ${Object.keys(CENARIOS).join(" | ")}`);

const token = process.env.HF_TOKEN as `hf_${string}` | undefined;
const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";

console.log(`\n▶ cenário: ${nome}`);
console.log(`  estilo: ${cenario.estilo}`);
console.log(`  letra:  ${cenario.letra.split("\n").length} linhas`);
console.log(`  token:  ${token ? "presente" : "AUSENTE (vai como anônimo)"}\n`);

const app = await Client.connect(SPACE, { hf_token: token });
console.log(`[${seg()}] conectado ao Space`);

const job = app.submit("/generation_wrapper", {
  generation_mode: "custom",
  simple_query_input: "", // só usado no modo "simple"
  param_14: null, // Reference Audio
  param_17: null, // Source Audio
  param_18: "", // Audio Codes
  param_47: null, // instrumento-alvo (só para modos de edição)
  param_4: cenario.estilo, // Prompt (= nosso Estilo)
  param_5: cenario.letra, // Lyrics
  param_9: "pt", // Vocal Language
  param_15: 30, // Audio Duration (s)
  param_16: 1, // batch size: 1 versão só, para poupar cota
  param_30: "mp3", // Audio Format
});

const batimento = setInterval(() => console.log(`[${seg()}] ... aguardando`), 30_000);

let resultado: unknown[] | undefined;
for await (const msg of job) {
  if (msg.type !== "status" && msg.type !== "data") console.log(`[${seg()}] evento: ${msg.type} ${JSON.stringify(msg).slice(0, 200)}`);
  if (msg.type === "status") {
    const s = msg as { stage?: string; position?: number; eta?: number; message?: string };
    console.log(
      `[${seg()}] status: ${s.stage}` +
        (s.position != null ? ` | posição na fila: ${s.position}` : "") +
        (s.eta != null ? ` | eta: ${s.eta.toFixed?.(0)}s` : "") +
        (s.message ? ` | msg: ${s.message}` : ""),
    );
    if (s.stage === "error") process.exit(1);
  }
  if (msg.type === "data") resultado = (msg as { data: unknown[] }).data;
}

clearInterval(batimento);
if (!resultado) throw new Error("nenhum dado retornado");

const amostra = resultado[0] as { url?: string } | null;
const detalhes = resultado[9];
const statusTexto = resultado[10];
console.log(`\n[${seg()}] concluído`);
console.log(`  Generation Status:  ${statusTexto}`);
console.log(`  Generation Details: ${String(detalhes).slice(0, 600)}`);

if (!amostra?.url) throw new Error("sem arquivo de áudio na resposta");
const resp = await fetch(amostra.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const buf = Buffer.from(await resp.arrayBuffer());
await mkdir("saida", { recursive: true });
const arquivo = `saida/${nome}.mp3`;
await writeFile(arquivo, buf);
console.log(`\n✔ áudio salvo em prototipo-ace-step/${arquivo} (${(buf.length / 1024).toFixed(0)} KB, ${resp.headers.get("content-type")})`);
console.log(`  tempo total: ${seg()}`);
process.exit(0);
