"use client";

import { useState } from "react";

interface Props {
  precosContent: React.ReactNode;
  sobreContent?: React.ReactNode;
}

export default function TabNav({ precosContent, sobreContent }: Props) {
  const [active, setActive] = useState<"precos" | "sobre">("precos");
  const tabs = [
    { id: "precos" as const, label: "Preços" },
    ...(sobreContent ? [{ id: "sobre" as const, label: "Sobre" }] : []),
  ];

  return (
    <div>
      <div className="flex border-b border-groove mb-6" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? "border-gold text-gold"
                : "border-transparent text-dust hover:text-parchment"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="tabpanel-precos" role="tabpanel" hidden={active !== "precos"}>
        {precosContent}
      </div>
      {sobreContent && (
        <div id="tabpanel-sobre" role="tabpanel" hidden={active !== "sobre"}>
          {sobreContent}
        </div>
      )}
    </div>
  );
}
