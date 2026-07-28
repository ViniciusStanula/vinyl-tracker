import { ImageResponse } from "next/og";
import { getDiscoWithPrecos } from "@/lib/db/disco";

export const revalidate = 7200;
export const alt = "Histórico de preço do disco de vinil";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const disco = await getDiscoWithPrecos(slug).catch(() => null);

  const valores = disco?.precos.map((p) => Number(p.precoBrl)) ?? [];
  const precoAtual = valores.at(-1) ?? null;
  const precoMin = valores.length ? Math.min(...valores) : null;
  const isAllTimeLow =
    precoAtual != null && precoMin != null && valores.length >= 2 && precoAtual <= precoMin;

  const fmt = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0c0a08",
          padding: 48,
          alignItems: "center",
          gap: 48,
          fontFamily: "sans-serif",
        }}
      >
        {disco?.imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={disco.imgUrl}
            alt=""
            width={420}
            height={420}
            style={{ borderRadius: 16, objectFit: "cover", border: "1px solid #2b1e17" }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
          <div style={{ color: "#d98f0e", fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
            Garimpa Vinil
          </div>
          <div style={{ color: "#f0e6d0", fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
            {(disco?.titulo ?? "Disco de Vinil").slice(0, 70)}
          </div>
          {disco?.artista && (
            <div style={{ color: "#b8936a", fontSize: 34 }}>{disco.artista}</div>
          )}
          {precoAtual != null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 8 }}>
              <div style={{ color: "#f0ab28", fontSize: 64, fontWeight: 800 }}>{fmt(precoAtual)}</div>
              {isAllTimeLow && (
                <div
                  style={{
                    color: "#35c47a",
                    fontSize: 30,
                    fontWeight: 700,
                    border: "2px solid #1e7a50",
                    borderRadius: 12,
                    padding: "4px 16px",
                  }}
                >
                  Menor preço histórico
                </div>
              )}
            </div>
          )}
          {precoMin != null && (
            // Interpolated into ONE string child on purpose. Satori throws
            // ("Expected <div> to have explicit display...") for a div with
            // more than one child and no explicit display, which 500'd this
            // route for every record that had price history. The throw happens
            // while streaming the response, so it can't be caught here.
            <div style={{ color: "#957060", fontSize: 26 }}>
              {`Menor preço já registrado: ${fmt(precoMin)} · Histórico de 12 meses`}
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
