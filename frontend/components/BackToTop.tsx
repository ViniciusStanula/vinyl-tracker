"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-full w-11 h-11 flex items-center justify-center shadow-lg transition-colors"
      aria-label="Voltar ao topo"
    >
      ↑
    </button>
  );
}
