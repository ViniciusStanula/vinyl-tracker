"use client";

import { useRef } from "react";

/* Controlled filter box shared by the browse hubs. The owning component keeps
   the query — /estilos re-renders from data, /artistas filters the DOM. */
export default function HubFilterInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <input
          id={id}
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-groove bg-sleeve py-3.5 pl-11 pr-24 text-sm text-cream placeholder:text-dust focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="font-mono absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-parchment hover:text-cream hover:bg-groove transition-colors"
          >
            Esc limpar
          </button>
        )}
      </div>
    </>
  );
}
