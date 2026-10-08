import {
  FalhaDefinitiva,
  type ArmazenamentoDeArquivos,
  type EventoDeCriacao,
  type GeradorDeImagem,
  type GeradorDeNarracao,
  type PublicadorDeEventos,
} from "./portas";

// Igual ao maxReceiveCount da fila no Terraform (sonare-api/infra/base/filas.tf):
// na terceira entrega sem sucesso, a SQS manda a mensagem para a DLQ.
const TENTATIVAS_MAXIMAS = 3;

const VOZES = ["pf_dora", "pm_alex", "pm_santa"];
const TEXTO_MAXIMO = 1000;
const DESCRICAO_MAXIMA = 500;

export type Resultado =
  | { tipo: "concluida" }
  | { tipo: "tentar-de-novo"; motivo: string }
  | { tipo: "falhou"; motivo: string } // falhou em todas as Tentativas: segue para a DLQ
  | { tipo: "recusada"; motivo: string }; // falha definitiva: sai da fila na hora, sem DLQ

type Pedido =
  | { tipo: "narracao"; criacaoId: string; texto: string; voz: string }
  | { tipo: "imagem"; criacaoId: string; descricao: string };

export type Dependencias = {
  geradorDeNarracao: GeradorDeNarracao;
  geradorDeImagem: GeradorDeImagem;
  armazenamento: ArmazenamentoDeArquivos;
  eventos: PublicadorDeEventos;
};

export async function processarMensagem(mensagem: { corpo: string; tentativa: number }, deps: Dependencias): Promise<Resultado> {
  const falhar = async (motivo: string, criacaoId?: string): Promise<Resultado> => {
    if (mensagem.tentativa < TENTATIVAS_MAXIMAS) return { tipo: "tentar-de-novo", motivo };
    if (criacaoId) await deps.eventos.publicar({ tipo: "CriacaoFalhou", criacaoId, motivo });
    return { tipo: "falhou", motivo };
  };

  const pedido = lerPedido(mensagem.corpo);
  if ("erro" in pedido) return falhar(pedido.erro, pedido.criacaoId);

  let aviso: EventoDeCriacao;
  try {
    aviso = pedido.tipo === "narracao" ? await narrar(pedido, deps) : await ilustrar(pedido, deps);
  } catch (erro) {
    // Insistir só no que pode dar certo na próxima vez (ADR 0012)
    if (erro instanceof FalhaDefinitiva) {
      await deps.eventos.publicar({ tipo: "CriacaoFalhou", criacaoId: pedido.criacaoId, motivo: erro.message, definitiva: true });
      return { tipo: "recusada", motivo: erro.message };
    }
    return falhar((erro as Error).message, pedido.criacaoId);
  }

  await deps.eventos.publicar(aviso);
  return { tipo: "concluida" };
}

async function narrar(pedido: Extract<Pedido, { tipo: "narracao" }>, deps: Dependencias): Promise<EventoDeCriacao> {
  const chaveAudio = `narracoes/${pedido.criacaoId}.mp3`;
  const audio = await deps.geradorDeNarracao.gerar({ texto: pedido.texto, voz: pedido.voz });
  await deps.armazenamento.salvar(chaveAudio, audio, "audio/mpeg");
  return { tipo: "CriacaoConcluida", criacaoId: pedido.criacaoId, chaveAudio };
}

async function ilustrar(pedido: Extract<Pedido, { tipo: "imagem" }>, deps: Dependencias): Promise<EventoDeCriacao> {
  const chaveImagem = `imagens/${pedido.criacaoId}.jpg`;
  const { imagem, prompt } = await deps.geradorDeImagem.gerar({ descricao: pedido.descricao });
  await deps.armazenamento.salvar(chaveImagem, imagem, "image/jpeg");
  return { tipo: "CriacaoConcluida", criacaoId: pedido.criacaoId, chaveImagem, prompt };
}

function lerPedido(corpo: string): Pedido | { erro: string; criacaoId?: string } {
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

  if (dados.tipo === "narracao") {
    if (typeof dados.texto !== "string" || !dados.texto.trim()) return erro("Texto vazio");
    if (dados.texto.length > TEXTO_MAXIMO) return erro("Texto com mais de 1.000 caracteres");
    if (!VOZES.includes(dados.voz)) return erro(`Voz desconhecida: ${dados.voz}`);
    return { tipo: "narracao", criacaoId, texto: dados.texto, voz: dados.voz };
  }

  if (dados.tipo === "imagem") {
    if (typeof dados.descricao !== "string" || !dados.descricao.trim()) return erro("Descrição vazia");
    if (dados.descricao.length > DESCRICAO_MAXIMA) return erro("Descrição com mais de 500 caracteres");
    return { tipo: "imagem", criacaoId, descricao: dados.descricao };
  }

  return erro(`tipo de Criação desconhecido: ${dados.tipo}`);
}
