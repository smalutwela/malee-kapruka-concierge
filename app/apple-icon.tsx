import { ImageResponse } from "next/og";

// iOS home-screen / bookmark icon (PNG, rendered from this component at build).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #9575e0, #e6b84a)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <g fill="#ffffff">
            <circle cx="16" cy="10.4" r="4.5" />
            <circle cx="10.67" cy="14.27" r="4.5" />
            <circle cx="12.71" cy="20.53" r="4.5" />
            <circle cx="19.29" cy="20.53" r="4.5" />
            <circle cx="21.33" cy="14.27" r="4.5" />
          </g>
          <circle cx="16" cy="16" r="3.3" fill="#ffd27f" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
