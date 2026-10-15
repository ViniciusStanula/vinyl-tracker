"use client";

import ArtistaRecords, { type FilterGroup } from "@/components/ArtistaRecords";
import type { ProcessedDisco } from "@/lib/queryDiscos";

// Lives in a client component because the chip tests are functions, which a
// server page cannot pass as props.

function tagged(...keywords: string[]) {
  return (d: ProcessedDisco) =>
    (d.lastfmTags ?? "")
      .toLowerCase()
      .split(",")
      .some((tag) => keywords.some((k) => tag.includes(k)));
}

// Picked from the tags the Black Friday list actually carries (Last.fm, so
// English); a chip with no matching record is hidden by ArtistaRecords.
const GROUPS: FilterGroup[] = [
  {
    label: "Estilo",
    options: [
      { label: "Rock",            test: tagged("rock") },
      { label: "Pop",             test: tagged("pop") },
      { label: "Folk e Country",  test: tagged("folk", "country", "americana", "singer-songwriter") },
      { label: "Jazz e Blues",    test: tagged("jazz", "blues") },
      { label: "Soul e Hip-Hop",  test: tagged("soul", "funk", "hip-hop", "hip hop", "rap", "r&b") },
      { label: "Eletrônica",      test: tagged("electronic", "ambient", "house", "techno", "synth") },
      { label: "Metal e Punk",    test: tagged("metal", "punk", "hardcore") },
      { label: "Brasileira",      test: tagged("mpb", "bossa nova", "samba", "brazil") },
      { label: "Trilhas sonoras", test: tagged("soundtrack") },
    ],
  },
  {
    label: "Histórico",
    options: [{ label: "Menor preço já registrado", test: (d) => d.menorPreco === true }],
  },
];

export default function BlackFridayRecords({ items }: { items: ProcessedDisco[] }) {
  return <ArtistaRecords items={items} slug="black-friday" basePath="" filterGroups={GROUPS} />;
}
