import { ImageResponse } from "next/og";

// Default 1200×630 OG/social image, generated at build time and served
// at /og-default.png. Referenced explicitly by pages that have no
// content-specific image (config openGraph does not deep-merge across
// segments, so a root file-convention image would not reliably apply).
export const dynamic = "force-static";

const GOLD = "#d98f0e";
const RECORD = "#0c0a08";
const SLEEVE = "#171210";
const CREAM = "#f0e6d0";
const PARCHMENT = "#b8936a";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: `linear-gradient(135deg, ${RECORD} 0%, ${SLEEVE} 100%)`,
          padding: "0 80px",
        }}
      >
        {/* Vinyl disc */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: GOLD,
            marginRight: 80,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 320,
              height: 320,
              borderRadius: 9999,
              border: `2px solid ${RECORD}`,
              background: GOLD,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 170,
                height: 170,
                borderRadius: 9999,
                background: RECORD,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  background: GOLD,
                }}
              />
            </div>
          </div>
        </div>

        {/* Wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: GOLD,
              lineHeight: 1,
            }}
          >
            Garimpa
          </div>
          <div
            style={{
              fontSize: 52,
              letterSpacing: 28,
              textTransform: "uppercase",
              color: CREAM,
              marginTop: 8,
            }}
          >
            Vinil
          </div>
          <div
            style={{
              fontSize: 30,
              color: PARCHMENT,
              marginTop: 36,
              maxWidth: 560,
              lineHeight: 1.35,
            }}
          >
            Melhores ofertas em discos de vinil na Amazon Brasil
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
