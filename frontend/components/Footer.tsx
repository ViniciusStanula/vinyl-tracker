import Link from "next/link";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const TELEGRAM_URL = "https://t.me/garimpavinil";

const TOP_ESTILOS = [
  { nome: "Rock",       slug: "rock" },
  { nome: "Jazz",       slug: "jazz" },
  { nome: "Pop",        slug: "pop" },
  { nome: "Clássica",   slug: "classical" },
  { nome: "Hip-Hop",    slug: "hip-hop" },
  { nome: "Blues",      slug: "blues" },
  { nome: "Eletrônica", slug: "electronic" },
  { nome: "Soul",       slug: "soul" },
  { nome: "Folk",       slug: "folk" },
  { nome: "Metal",      slug: "metal" },
  { nome: "Samba",      slug: "samba" },
  { nome: "MPB",        slug: "mpb" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-groove bg-record">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 sm:col-span-2">
          <p className="font-display font-bold text-cream mb-1 text-base">Garimpa Vinil</p>
          <p className="text-dust text-xs leading-relaxed max-w-xs">
            Monitora preços de vinis na Amazon a cada 2 horas. Histórico completo de preços e detecção automática de promoções.
          </p>
          <div className="mt-4 flex flex-col gap-1">
            <Link href="/"       className="text-dust hover:text-cream transition-colors">Início</Link>
            <Link href="/disco"  className="text-dust hover:text-cream transition-colors">Todos os Discos</Link>
            <Link href="/sobre"  className="text-dust hover:text-cream transition-colors">Sobre</Link>
          </div>
          <div className="mt-4">
            <Link
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-dust hover:text-gold transition-colors group"
            >
              <TelegramIcon className="w-5 h-5 text-[#29ABE2] group-hover:text-gold transition-colors shrink-0" />
              <span className="text-xs">Canal de ofertas no Telegram</span>
            </Link>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-2">
          <p className="font-semibold text-cream mb-3">Explorar por Estilo</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {TOP_ESTILOS.map(({ nome, slug }) => (
              <li key={slug}>
                <Link href={`/estilo/${slug}`} className="text-dust hover:text-cream transition-colors">
                  {nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-groove/50 px-4 py-4 text-center text-xs text-dust">
        <p>
          Como Associado Amazon, ganhamos comissão nas compras qualificadas sem custo adicional para você. Os preços são da Amazon e podem variar.{" "}
          <Link href="/sobre" className="hover:text-parchment transition-colors underline underline-offset-2">
            Saiba mais
          </Link>
        </p>
      </div>
    </footer>
  );
}
