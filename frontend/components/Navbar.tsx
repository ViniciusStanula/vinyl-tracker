import Link from "next/link";
import { Suspense } from "react";
import SearchBar from "./SearchBar";

function VinylLogo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0">
      {/* Outer disc */}
      <circle cx="20" cy="20" r="19" fill="#d98f0e" />
      {/* Groove rings on the disc */}
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="#0c0a08" strokeWidth="1"   opacity="0.35" />
      <circle cx="20" cy="20" r="14"   fill="none" stroke="#0c0a08" strokeWidth="0.7" opacity="0.30" />
      <circle cx="20" cy="20" r="11.5" fill="none" stroke="#0c0a08" strokeWidth="0.6" opacity="0.25" />
      {/* Center label */}
      <circle cx="20" cy="20" r="9" fill="#0c0a08" />
      <circle cx="20" cy="20" r="8"   fill="none" stroke="#d98f0e" strokeWidth="0.5" opacity="0.4" />
      <circle cx="20" cy="20" r="5.5" fill="none" stroke="#d98f0e" strokeWidth="0.4" opacity="0.25" />
      {/* Spindle hole */}
      <circle cx="20" cy="20" r="2.2" fill="#d98f0e" opacity="0.85" />
      <circle cx="20" cy="20" r="0.9" fill="#0c0a08" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-record/95 backdrop-blur-md border-b border-groove/60">
      <div className="max-w-7xl mx-auto px-4 h-[62px] flex items-center gap-5">

        {/* ── Brand ── */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <VinylLogo />
          <div className="hidden sm:flex flex-col leading-none">
            <span
              className="text-[21px] font-black text-cream tracking-tight"
              style={{ fontFamily: "var(--font-fraunces, serif)" }}
            >
              Garimpa
            </span>
            <span className="text-gold text-[9px] tracking-[0.38em] uppercase font-semibold mt-px">
              vinil
            </span>
          </div>
        </Link>

        {/* ── Search ── */}
        <div className="flex-1 max-w-2xl">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}
