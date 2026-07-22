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

// Last.fm style tags that are really a country or nationality, mapped to the
// canonical /pais/<slug>. These tags described the artist's origin, not a
// musical genre, so they belong on the country pages — mirrors the
// artist-name → /artista redirects in REDIRECTED_ESTILO_SLUGS.
//
// ONLY countries with a populated /pais page are listed: /pais/[slug] 404s when
// a country has no MB-origin records, so redirecting such a tag would 301 into
// a 404. Re-check MB-origin counts (ArtistMeta.country) before adding more —
// e.g. cuba/china/austria/india/portugal were empty at creation and omitted.
export const COUNTRY_TAG_TO_PAIS_SLUG: Record<string, string> = {
  usa: "estados-unidos", america: "estados-unidos", american: "estados-unidos",
  "united-states": "estados-unidos",
  uk: "reino-unido", britain: "reino-unido", british: "reino-unido",
  "great-britain": "reino-unido", england: "reino-unido", english: "reino-unido",
  scotland: "reino-unido", scottish: "reino-unido", wales: "reino-unido", welsh: "reino-unido",
  canada: "canada", canadian: "canada",
  brazil: "brasil", brasil: "brasil", brazilian: "brasil",
  australia: "australia", australian: "australia",
  germany: "alemanha", german: "alemanha",
  sweden: "suecia", swedish: "suecia",
  ireland: "irlanda", irish: "irlanda",
  france: "franca", french: "franca",
  italy: "italia", italian: "italia",
  norway: "noruega", norwegian: "noruega",
  iceland: "islandia", icelandic: "islandia",
  japan: "japao", japanese: "japao",
  jamaica: "jamaica", jamaican: "jamaica",
  korea: "coreia-do-sul", korean: "coreia-do-sul", "south-korea": "coreia-do-sul",
  finland: "finlandia", finnish: "finlandia",
  netherlands: "paises-baixos", dutch: "paises-baixos", holland: "paises-baixos",
  argentina: "argentina", argentine: "argentina", argentinian: "argentina",
  mexico: "mexico", mexican: "mexico",
  spain: "espanha", spanish: "espanha",
  denmark: "dinamarca", danish: "dinamarca",
  switzerland: "suica", swiss: "suica",
  greece: "grecia", greek: "grecia",
  poland: "polonia", polish: "polonia",
  belgium: "belgica", belgian: "belgica",
  russia: "russia", russian: "russia",
};
