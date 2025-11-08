"use client";

import { authClient } from "@packages/auth/src/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Page() {
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (session.data?.user) {
      router.push("/dashboard");
    }
  }, [session.data, router]);

  // Show loading state while checking session
  if (session.isPending) {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "2rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "2rem" }}>
      <h1
        style={{
          fontSize: "1.875rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        MCP-RTM Portal
      </h1>
      <p style={{ marginBottom: "1.5rem", color: "#4b5563" }}>
        Connect your Remember The Milk account to use it with AI assistants via
        MCP.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "20rem",
        }}
      >
        <a
          href="/login"
          style={{
            display: "block",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            textAlign: "center",
            fontWeight: "500",
          }}
        >
          Sign In
        </a>

        <a
          href="/signup"
          style={{
            display: "block",
            padding: "0.75rem 1.5rem",
            backgroundColor: "white",
            color: "#2563eb",
            border: "1px solid #2563eb",
            borderRadius: "0.5rem",
            textDecoration: "none",
            textAlign: "center",
            fontWeight: "500",
          }}
        >
          Create Account
        </a>

        <p
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginTop: "0.5rem",
            textAlign: "center",
          }}
        >
          Sign in to connect your Remember The Milk account
        </p>
      </div>
    </main>
  );
}
