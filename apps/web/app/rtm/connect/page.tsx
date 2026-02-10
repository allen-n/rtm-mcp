"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function RtmConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the auth URL from query params (passed from backend)
    const url = searchParams.get("authUrl");
    if (url) {
      setAuthUrl(decodeURIComponent(url));
    } else {
      setError("Missing authorization URL");
    }
  }, [searchParams]);

  const handleComplete = () => {
    router.push("/rtm/callback");
  };

  if (error) {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            padding: "1.5rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#7f1d1d",
              marginBottom: "0.5rem",
            }}
          >
            Error
          </h1>
          <p style={{ color: "#991b1b" }}>{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!authUrl) {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}>
      <h1
        style={{
          fontSize: "1.875rem",
          fontWeight: "bold",
          marginBottom: "2rem",
        }}
      >
        🔗 Connect to Remember The Milk
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Step 1 */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            padding: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginBottom: "0.75rem",
            }}
          >
            Step 1: Authorize on RTM
          </h2>
          <p style={{ color: "#374151", marginBottom: "1rem" }}>
            Click the button below to open Remember The Milk and authorize this
            application:
          </p>
          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: "500",
              borderRadius: "0.5rem",
              textDecoration: "none",
            }}
          >
            Open Remember The Milk
          </a>
        </div>

        {/* Step 2 */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            padding: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginBottom: "0.75rem",
            }}
          >
            Step 2: Return Here
          </h2>
          <p style={{ color: "#374151", marginBottom: "1rem" }}>
            After authorizing on RTM, click this button to complete the
            connection:
          </p>
          <button
            onClick={handleComplete}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#374151",
              color: "white",
              fontWeight: "500",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            I've Authorized - Complete Setup
          </button>
        </div>

        {/* Help text */}
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "0.5rem",
            padding: "1rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "#1e3a8a" }}>
            <strong>Note:</strong> You'll need to complete the authorization on
            Remember The Milk's website before clicking the "Complete Setup"
            button.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RtmConnectPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{ maxWidth: "48rem", margin: "4rem auto", padding: "1rem" }}
        >
          <p>Loading...</p>
        </main>
      }
    >
      <RtmConnectContent />
    </Suspense>
  );
}
