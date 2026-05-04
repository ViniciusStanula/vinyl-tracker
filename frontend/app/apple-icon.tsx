import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const gold = "#d98f0e";
  const record = "#0c0a08";

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: gold,
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
            width: 152,
            height: 152,
            borderRadius: "50%",
            border: "2px solid rgba(12,10,8,0.40)",
          }}
        />
        {/* Groove ring 2 */}
        <div
          style={{
            position: "absolute",
            width: 124,
            height: 124,
            borderRadius: "50%",
            border: "1.5px solid rgba(12,10,8,0.32)",
          }}
        />
        {/* Center label */}
        <div
          style={{
            position: "absolute",
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: record,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Spindle hole */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: gold,
              opacity: 0.88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: record,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
