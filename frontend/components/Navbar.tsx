import Link from "next/link";
import { Suspense } from "react";
import SearchBar from "./SearchBar";

function VinylIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-8 h-8 text-amber-500"
      fill="currentColor"
    >
      <circle cx="16" cy="16" r="14" />
      <circle cx="16" cy="16" r="8" fill="#09090b" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#09090b" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="#09090b" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <VinylIcon />
          <span className="font-bold text-white text-base tracking-tight hidden sm:block">
            Garimpa Vinil
          </span>
        </Link>

        <div className="flex-1 max-w-2xl">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}
