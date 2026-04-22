"use client";

import { useEffect, useState } from "react";

export default function TempoAtualizado({ updatedAt }: { updatedAt: Date }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function compute() {
      const horas = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60));
      if (horas === 0) return "menos de 1 hora";
      if (horas === 1) return "1 hora";
      return `${horas} horas`;
    }
    setLabel(compute());
  }, [updatedAt]);

  if (label === null) return null;

  return <>Atualizado há {label} · Preços podem variar</>;
}
