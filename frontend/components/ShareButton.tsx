"use client";

interface Props {
  titulo: string;
  artista: string;
}

export default function ShareButton({ titulo, artista }: Props) {
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${titulo} — ${artista}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-groove hover:border-gold hover:text-gold text-dust font-semibold text-sm transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      Compartilhar
    </button>
  );
}
