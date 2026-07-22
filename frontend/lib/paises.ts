// ISO 3166-1 alpha-2 → Brazilian-Portuguese country name.
// MusicBrainz stores an artist's origin as this ISO code (ArtistMeta.country);
// we render/slug the PT-BR name so pages read "Estados Unidos", not "United
// States". Codes are the source of truth in the DB — names live only here, so a
// wording tweak never requires a data migration.
export const PAIS_PT: Record<string, string> = {
  AD: "Andorra", AE: "Emirados Árabes Unidos", AF: "Afeganistão", AG: "Antígua e Barbuda",
  AL: "Albânia", AM: "Armênia", AO: "Angola", AR: "Argentina", AT: "Áustria",
  AU: "Austrália", AZ: "Azerbaijão", BA: "Bósnia e Herzegovina", BB: "Barbados",
  BD: "Bangladesh", BE: "Bélgica", BF: "Burquina Faso", BG: "Bulgária", BH: "Bahrein",
  BI: "Burundi", BJ: "Benim", BN: "Brunei", BO: "Bolívia", BR: "Brasil", BS: "Bahamas",
  BT: "Butão", BW: "Botsuana", BY: "Bielorrússia", BZ: "Belize", CA: "Canadá",
  CD: "República Democrática do Congo", CF: "República Centro-Africana", CG: "Congo",
  CH: "Suíça", CI: "Costa do Marfim", CL: "Chile", CM: "Camarões", CN: "China",
  CO: "Colômbia", CR: "Costa Rica", CU: "Cuba", CV: "Cabo Verde", CY: "Chipre",
  CZ: "Tchéquia", DE: "Alemanha", DJ: "Djibuti", DK: "Dinamarca", DM: "Dominica",
  DO: "República Dominicana", DZ: "Argélia", EC: "Equador", EE: "Estônia", EG: "Egito",
  ER: "Eritreia", ES: "Espanha", ET: "Etiópia", FI: "Finlândia", FJ: "Fiji",
  FM: "Micronésia", FO: "Ilhas Faroé", FR: "França", GA: "Gabão", GB: "Reino Unido",
  GD: "Granada", GE: "Geórgia", GH: "Gana", GL: "Groenlândia", GM: "Gâmbia", GN: "Guiné",
  GQ: "Guiné Equatorial", GR: "Grécia", GT: "Guatemala", GW: "Guiné-Bissau", GY: "Guiana",
  HK: "Hong Kong", HN: "Honduras", HR: "Croácia", HT: "Haiti", HU: "Hungria",
  ID: "Indonésia", IE: "Irlanda", IL: "Israel", IN: "Índia", IQ: "Iraque", IR: "Irã",
  IS: "Islândia", IT: "Itália", JM: "Jamaica", JO: "Jordânia", JP: "Japão", KE: "Quênia",
  KG: "Quirguistão", KH: "Camboja", KI: "Quiribati", KM: "Comores",
  KN: "São Cristóvão e Névis", KP: "Coreia do Norte", KR: "Coreia do Sul", KW: "Kuwait",
  KZ: "Cazaquistão", LA: "Laos", LB: "Líbano", LC: "Santa Lúcia", LI: "Listenstaine",
  LK: "Sri Lanka", LR: "Libéria", LS: "Lesoto", LT: "Lituânia", LU: "Luxemburgo",
  LV: "Letônia", LY: "Líbia", MA: "Marrocos", MC: "Mônaco", MD: "Moldávia",
  ME: "Montenegro", MG: "Madagascar", MH: "Ilhas Marshall", MK: "Macedônia do Norte",
  ML: "Mali", MM: "Mianmar", MN: "Mongólia", MO: "Macau", MR: "Mauritânia", MT: "Malta",
  MU: "Maurício", MV: "Maldivas", MW: "Malawi", MX: "México", MY: "Malásia",
  MZ: "Moçambique", NA: "Namíbia", NE: "Níger", NG: "Nigéria", NI: "Nicarágua",
  NL: "Países Baixos", NO: "Noruega", NP: "Nepal", NR: "Nauru", NZ: "Nova Zelândia",
  OM: "Omã", PA: "Panamá", PE: "Peru", PG: "Papua-Nova Guiné", PH: "Filipinas",
  PK: "Paquistão", PL: "Polônia", PR: "Porto Rico", PS: "Palestina", PT: "Portugal",
  PY: "Paraguai", QA: "Catar", RO: "Romênia", RS: "Sérvia", RU: "Rússia", RW: "Ruanda",
  SA: "Arábia Saudita", SB: "Ilhas Salomão", SC: "Seicheles", SD: "Sudão", SE: "Suécia",
  SG: "Singapura", SI: "Eslovênia", SK: "Eslováquia", SL: "Serra Leoa", SM: "San Marino",
  SN: "Senegal", SO: "Somália", SR: "Suriname", SS: "Sudão do Sul",
  ST: "São Tomé e Príncipe", SV: "El Salvador", SY: "Síria", SZ: "Essuatíni", TD: "Chade",
  TG: "Togo", TH: "Tailândia", TJ: "Tadjiquistão", TL: "Timor-Leste", TM: "Turcomenistão",
  TN: "Tunísia", TO: "Tonga", TR: "Turquia", TT: "Trinidad e Tobago", TW: "Taiwan",
  TZ: "Tanzânia", UA: "Ucrânia", UG: "Uganda", US: "Estados Unidos", UY: "Uruguai",
  UZ: "Uzbequistão", VA: "Vaticano", VC: "São Vicente e Granadinas", VE: "Venezuela",
  VN: "Vietnã", VU: "Vanuatu", WS: "Samoa", XK: "Kosovo", YE: "Iêmen",
  ZA: "África do Sul", ZM: "Zâmbia", ZW: "Zimbábue",
};

const ACCENTS = /[̀-ͯ]/g;

// Slugify a PT-BR country name: fold accents, lowercase, hyphenate.
// "Estados Unidos" → "estados-unidos"; "São Tomé e Príncipe" → "sao-tome-e-principe".
function slugifyPais(name: string): string {
  return name
    .normalize("NFD")
    .replace(ACCENTS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// slug → ISO2 (e.g. "estados-unidos" → "US"), built once from PAIS_PT.
export const SLUG_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(PAIS_PT).map(([iso2, name]) => [slugifyPais(name), iso2]),
);

// ISO2 → slug (e.g. "US" → "estados-unidos"), built once from PAIS_PT.
export const ISO2_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PAIS_PT).map(([iso2, name]) => [iso2, slugifyPais(name)]),
);

export function getPaisDisplayName(iso2: string): string | null {
  return PAIS_PT[iso2] ?? null;
}
