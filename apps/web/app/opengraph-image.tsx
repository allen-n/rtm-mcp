/* eslint-disable jsx-a11y/alt-text */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px 96px",
        color: "#e9f4ff",
        background:
          "radial-gradient(circle at 20% 20%, #4cb2ff 0, rgba(76,178,255,0) 22%), radial-gradient(circle at 80% 0%, #74f0ff 0, rgba(116,240,255,0) 25%), linear-gradient(135deg, #0a2f73 0%, #0d5ed8 50%, #0cc4ff 100%)",
        borderRadius: 32,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 32,
            background: "linear-gradient(140deg, #3a7bff, #19c3ff)",
            display: "flex",
            placeItems: "center",
            boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
          }}
        >
          <svg
            viewBox="0 0 64 64"
            width="78"
            height="78"
            fill="none"
            role="img"
            aria-label="RTM icon"
          >
            <path
              d="M32 10c-6.4 8.6-12.8 15.1-12.8 23.4 0 8 6 14.6 12.8 14.6s12.8-6.6 12.8-14.6C44.8 25 38.4 18.6 32 10z"
              fill="#f8fbff"
            />
            <path
              d="M32 16.5c-4.4 6.2-8.8 10.9-8.8 17 0 5.5 4 10 8.8 10s8.8-4.5 8.8-10c0-6.2-4.4-10.9-8.8-17z"
              fill="rgba(255,255,255,0.4)"
            />
            <path
              d="M24.5 34.5l5 5.2 10.5-12.5"
              stroke="#0f62fe"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="22" r="3.2" fill="#d6ecff" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.5 }}>
            RTM MCP Server
          </div>
          <div style={{ fontSize: 30, color: "#d9eaff", maxWidth: 720 }}>
            Connect Remember The Milk to Claude and other AI assistants via the
            Model Context Protocol.
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 26,
          color: "#cfe7ff",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              background: "#7cf7d7",
              boxShadow: "0 0 0 6px rgba(124,247,215,0.16)",
            }}
          />
          Bridge your tasks with AI-powered workflows.
        </div>
        <div style={{ fontWeight: 600, color: "#ffffff" }}>rtm mcp</div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
