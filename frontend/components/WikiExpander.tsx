"use client";

import { useState } from "react";

interface Props {
  text: string;
  previewLength?: number;
}

export default function WikiExpander({ text, previewLength = 400 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > previewLength;
  const displayed = needsTruncation && !expanded ? text.slice(0, previewLength).trimEnd() + "…" : text;

  return (
    <div>
      <p className="text-sm text-dust leading-relaxed whitespace-pre-line">{displayed}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs text-gold hover:text-parchment transition-colors font-medium"
        >
          {expanded ? "Ler menos" : "Ler mais"}
        </button>
      )}
    </div>
  );
}
