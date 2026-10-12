import { ImageResponse } from "next/og";

// Square 512×512 brand logo, generated at build time and served at
// /logo.png. Referenced by the Organization JSON-LD `logo` in layout.tsx,
// which Google uses for the brand's search results and knowledge panel.
// The 1200×630 /og-default.png banner is the wrong shape for that slot.
// Same record mark as apple-icon.tsx, scaled up; transparent corners so it
// sits cleanly on Google's white background.
export const dynamic = "force-static";

const GOLD = "#d98f0e";
const RECORD = "#0c0a08";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: "50%",
          background: GOLD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Groove ring 1 */}
        <div
          style={{
            position: "absolute",
            width: 432,
            height: 432,
            borderRadius: "50%",
            border: "6px solid rgba(12,10,8,0.40)",
          }}
        />
        {/* Groove ring 2 */}
        <div
          style={{
            position: "absolute",
            width: 352,
            height: 352,
            borderRadius: "50%",
            border: "4px solid rgba(12,10,8,0.32)",
          }}
        />
        {/* Center label */}
        <div
          style={{
            position: "absolute",
            width: 256,
            height: 256,
            borderRadius: "50%",
            background: RECORD,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Spindle hole */}
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: "50%",
              background: GOLD,
              opacity: 0.88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: RECORD,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
