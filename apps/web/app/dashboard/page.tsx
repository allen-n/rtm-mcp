"use client";

import { authClient } from "@packages/auth/src/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

type RtmStatus = {
  connected: boolean;
  username?: string;
  perms?: string;
  lastUpdated?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [rtmStatus, setRtmStatus] = useState<RtmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Use better-auth's reactive session hook
  const session = authClient.useSession();

  useEffect(() => {
    async function loadData() {
      try {
        // Check if user is authenticated
        if (!session.data?.user) {
          router.push("/login");
          return;
        }

        // Load RTM status
        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";
        const statusRes = await fetch(`${apiBase}/rtm/status`, {
          credentials: "include",
        });

        if (statusRes.ok) {
          const status = await statusRes.json();
          setRtmStatus(status);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, session.data]);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleDisconnectRtm = async () => {
    if (!confirm("Are you sure you want to disconnect Remember The Milk?")) {
      return;
    }

    setDisconnecting(true);
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";
      const res = await fetch(`${apiBase}/rtm/disconnect`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setRtmStatus({ connected: false });
      } else {
        alert("Failed to disconnect. Please try again.");
      }
    } catch (error) {
      console.error("Disconnect failed:", error);
      alert("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "2rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";

  return (
    <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.875rem", fontWeight: "bold" }}>Dashboard</h1>
        <button
          onClick={handleSignOut}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>

      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "1.5rem",
          borderRadius: "0.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            marginBottom: "0.5rem",
          }}
        >
          Account
        </h2>
        <p style={{ color: "#6b7280" }}>
          <strong>Email:</strong> {session.data?.user?.email}
        </p>
        {session.data?.user?.name && (
          <p style={{ color: "#6b7280" }}>
            <strong>Name:</strong> {session.data.user.name}
          </p>
        )}
      </div>

      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "1.5rem",
          borderRadius: "0.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            marginBottom: "1rem",
          }}
        >
          Remember The Milk Connection
        </h2>

        {rtmStatus?.connected ? (
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#dcfce7",
                color: "#166534",
                borderRadius: "0.375rem",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>✓</span>
              <span>Connected</span>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <p style={{ color: "#6b7280" }}>
                <strong>Username:</strong> {rtmStatus.username}
              </p>
              <p style={{ color: "#6b7280" }}>
                <strong>Permissions:</strong> {rtmStatus.perms}
              </p>
              {rtmStatus.lastUpdated && (
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Last updated:{" "}
                  {new Date(rtmStatus.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            <button
              onClick={handleDisconnectRtm}
              disabled={disconnecting}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: disconnecting ? "#9ca3af" : "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: disconnecting ? "not-allowed" : "pointer",
              }}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
              Connect your Remember The Milk account to use it with AI
              assistants via MCP.
            </p>
            <a
              href={`${apiBase}/rtm/start`}
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#2563eb",
                color: "white",
                borderRadius: "0.5rem",
                textDecoration: "none",
              }}
            >
              Connect Remember The Milk
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
