import { ImageResponse } from "next/og";

// Social share card (used for Open Graph + Twitter), rendered to PNG at build.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Malee — your Kapruka shopping concierge";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #0f7a5f 0%, #0c6b52 60%, #e0922b 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="110" height="110" viewBox="0 0 32 32" style={{ marginRight: "30px" }}>
            <g fill="#ffffff">
              <circle cx="16" cy="10.4" r="4.5" />
              <circle cx="10.67" cy="14.27" r="4.5" />
              <circle cx="12.71" cy="20.53" r="4.5" />
              <circle cx="19.29" cy="20.53" r="4.5" />
              <circle cx="21.33" cy="14.27" r="4.5" />
            </g>
            <circle cx="16" cy="16" r="3.3" fill="#ffd27f" />
          </svg>
          <div style={{ fontSize: "94px", fontWeight: 700, letterSpacing: "-3px" }}>Malee</div>
        </div>
        <div style={{ display: "flex", fontSize: "46px", fontWeight: 600, marginTop: "30px" }}>
          Your Kapruka shopping concierge
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            marginTop: "20px",
            opacity: 0.92,
            maxWidth: "960px",
          }}
        >
          Ayubowan! Shop groceries, gadgets, home and beauty — or send the perfect gift,
          delivered anywhere in Sri Lanka.
        </div>
      </div>
    ),
    { ...size },
  );
}
