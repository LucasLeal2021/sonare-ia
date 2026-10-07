import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { Config } from "../config";
import type { PublicadorDeEventos } from "../portas";

// A regra do Terraform (sonare-api/infra/base/eventos.tf) filtra por esta origem
const ORIGEM = "sonare.ia";

export function criarPublicadorEventBridge(config: Config): PublicadorDeEventos {
  const eventbridge = new EventBridgeClient({});

  return {
    async publicar({ tipo, ...detalhe }) {
      const resposta = await eventbridge.send(
        new PutEventsCommand({
          Entries: [
            { EventBusName: config.barramentoEventos, Source: ORIGEM, DetailType: tipo, Detail: JSON.stringify(detalhe) },
          ],
        }),
      );
      // PutEvents não lança erro quando uma entrada falha: é preciso conferir
      if (resposta.FailedEntryCount) {
        throw new Error(`EventBridge recusou ${tipo}: ${resposta.Entries?.[0]?.ErrorMessage}`);
      }
    },
  };
}
