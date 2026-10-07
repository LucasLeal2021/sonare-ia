import type { ArmazenamentoDeAudio, GeradorDeNarracao, PublicadorDeEventos } from "./portas";

// Igual ao maxReceiveCount da fila no Terraform (sonare-api/infra/base/filas.tf):
// na terceira entrega sem sucesso, a SQS manda a mensagem para a DLQ.
const TENTATIVAS_MAXIMAS = 3;

const VOZES = ["pf_dora", "pm_alex", "pm_santa"];
const TEXTO_MAXIMO = 1000;

export type Resultado =
  | { tipo: "concluida" }
  | { tipo: "tentar-de-novo"; motivo: string }
  | { tipo: "falhou"; motivo: string };

type PedidoDeNarracao = { criacaoId: string; texto: string; voz: string };

export async function processarMensagem(
  mensagem: { corpo: string; tentativa: number },
  deps: { gerador: GeradorDeNarracao; armazenamento: ArmazenamentoDeAudio; eventos: PublicadorDeEventos },
): Promise<Resultado> {
  const falhar = async (motivo: string, criacaoId?: string): Promise<Resultado> => {
    if (mensagem.tentativa < TENTATIVAS_MAXIMAS) return { tipo: "tentar-de-novo", motivo };
    if (criacaoId) await deps.eventos.publicar({ tipo: "CriacaoFalhou", criacaoId, motivo });
    return { tipo: "falhou", motivo };
  };

  const pedido = lerPedido(mensagem.corpo);
  if ("erro" in pedido) return falhar(pedido.erro, pedido.criacaoId);

  const chaveAudio = `narracoes/${pedido.criacaoId}.mp3`;
  let audio: Uint8Array;
  try {
    audio = await deps.gerador.gerar({ texto: pedido.texto, voz: pedido.voz });
  } catch (erro) {
    return falhar((erro as Error).message, pedido.criacaoId);
  }

  await deps.armazenamento.salvar(chaveAudio, audio);
  await deps.eventos.publicar({ tipo: "CriacaoConcluida", criacaoId: pedido.criacaoId, chaveAudio });

  return { tipo: "concluida" };
}

function lerPedido(corpo: string): PedidoDeNarracao | { erro: string; criacaoId?: string } {
  let dados: any;
  try {
    dados = JSON.parse(corpo);
  } catch {
    return { erro: "mensagem não é um JSON válido" };
  }

  const criacaoId = typeof dados?.criacaoId === "string" ? dados.criacaoId : undefined;
  const erro = (texto: string) => ({ erro: texto, criacaoId });

  if (dados.versao !== 1) return erro(`versão de mensagem não suportada: ${dados.versao}`);
  if (!criacaoId) return erro("mensagem sem criacaoId");
  if (typeof dados.texto !== "string" || !dados.texto.trim()) return erro("Texto vazio");
  if (dados.texto.length > TEXTO_MAXIMO) return erro("Texto com mais de 1.000 caracteres");
  if (!VOZES.includes(dados.voz)) return erro(`Voz desconhecida: ${dados.voz}`);

  return { criacaoId, texto: dados.texto, voz: dados.voz };
}
