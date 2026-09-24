/**
 * Per-marketplace display strings for buy buttons, JSON-LD, and pt-BR copy.
 * `disco.marketplace` values today: "amazon" (default), "mercadolivre", "umusicstore".
 * Unknown values fall back to the Amazon strings.
 */
const NOME: Record<string, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  umusicstore: "UMusic Store",
};

const NOME_PAIS: Record<string, string> = {
  amazon: "Amazon Brasil",
  mercadolivre: "Mercado Livre Brasil",
  umusicstore: "UMusic Store",
};

// pt-BR preposition + store name, e.g. "na Amazon" / "no Mercado Livre".
const PREP: Record<string, string> = {
  amazon: "na Amazon",
  mercadolivre: "no Mercado Livre",
  umusicstore: "na UMusic Store",
};

const PREP_PAIS: Record<string, string> = {
  amazon: "na Amazon Brasil",
  mercadolivre: "no Mercado Livre Brasil",
  umusicstore: "na UMusic Store",
};

export function lojaNome(marketplace: string): string {
  return NOME[marketplace] ?? NOME.amazon;
}

export function sellerName(marketplace: string): string {
  return NOME_PAIS[marketplace] ?? NOME_PAIS.amazon;
}

export function lojaComPrep(marketplace: string): string {
  return PREP[marketplace] ?? PREP.amazon;
}

export function lojaComPrepPais(marketplace: string): string {
  return PREP_PAIS[marketplace] ?? PREP_PAIS.amazon;
}
