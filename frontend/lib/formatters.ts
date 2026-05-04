export function formatDiscoCount(count: number): string {
  if (count === 0) return "Nenhum disco de vinil encontrado";
  return count === 1
    ? "1 disco de vinil encontrado"
    : `${count} discos de vinil encontrados`;
}
