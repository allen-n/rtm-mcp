"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RtmCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeAuth() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";
        const res = await fetch(`${apiBase}/rtm/complete`, {
          credentials: "include",
        });

        if (res.ok) {
          setStatus("success");
        } else {
          const text = await res.text();
          setError(text || "Failed to complete authorization");
          setStatus("error");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to complete authorization"
        );
        setStatus("error");
      }
    }

    completeAuth();
  }, []);

  const handleGoHome = () => {
    router.push("/dashboard");
  };

  if (status === "loading") {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              width: "3rem",
              height: "3rem",
              border: "2px solid #e5e7eb",
              borderTopColor: "#2563eb",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "1rem",
            }}
          ></div>
          <p style={{ fontSize: "1.125rem", color: "#374151" }}>
            Completing authorization with Remember The Milk...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3.75rem", marginBottom: "1rem" }}>❌</div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#7f1d1d",
              marginBottom: "1rem",
            }}
          >
            Connection Failed
          </h1>
          <p style={{ color: "#991b1b", marginBottom: "1.5rem" }}>{error}</p>
          <div
            style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
          >
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#dc2626",
                color: "white",
                fontWeight: "500",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#e5e7eb",
                color: "#1f2937",
                fontWeight: "500",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "0.5rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3.75rem", marginBottom: "1rem" }}>✅</div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "#14532d",
            marginBottom: "1rem",
          }}
        >
          Successfully connected to Remember The Milk!
        </h1>
        <p style={{ color: "#15803d", marginBottom: "1.5rem" }}>
          Your Remember The Milk account is now connected. You can now use it
          with AI assistants via MCP.
        </p>
        <button
          onClick={handleGoHome}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#16a34a",
            color: "white",
            fontWeight: "500",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </main>
  );
}
