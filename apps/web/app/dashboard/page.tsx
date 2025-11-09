"use client";

import { authClient } from "@packages/auth/src/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

type RtmStatus = {
  connected: boolean;
  username?: string;
  perms?: string;
  lastUpdated?: string;
  error?: string;
  details?: {
    checkToken?: { valid: boolean; error: string | null };
    testLogin?: { valid: boolean; error: string | null };
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [rtmStatus, setRtmStatus] = useState<RtmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  const handleDisconnectRtm = () => {
    setShowDisconnectModal(true);
    setVerifyError(null);
  };

  const handleVerifyDisconnect = async () => {
    setVerifying(true);
    setVerifyError(null);

    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";
      const res = await fetch(`${apiBase}/rtm/verify-disconnect`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();

        if (data.revoked) {
          // Successfully disconnected
          setRtmStatus({ connected: false });
          setShowDisconnectModal(false);
          alert("Successfully disconnected from Remember The Milk!");
        } else {
          // Token still active
          setVerifyError(
            "Your token is still active. Please make sure you've revoked access on the RTM website."
          );
        }
      } else {
        setVerifyError("Failed to verify disconnect status. Please try again.");
      }
    } catch (error) {
      console.error("Verify disconnect failed:", error);
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifying(false);
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
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            {rtmStatus?.error && (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "1rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.375rem",
                }}
              >
                <p
                  style={{
                    color: "#991b1b",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                  }}
                >
                  Connection Error: {rtmStatus.error}
                </p>
                {rtmStatus.details && (
                  <div style={{ fontSize: "0.875rem", color: "#7f1d1d" }}>
                    <p style={{ marginTop: "0.5rem" }}>
                      <strong>checkToken:</strong>{" "}
                      {rtmStatus.details.checkToken?.valid
                        ? "✓ Valid"
                        : "✗ Invalid"}
                      {rtmStatus.details.checkToken?.error && (
                        <span> - {rtmStatus.details.checkToken.error}</span>
                      )}
                    </p>
                    <p style={{ marginTop: "0.25rem" }}>
                      <strong>testLogin:</strong>{" "}
                      {rtmStatus.details.testLogin?.valid
                        ? "✓ Valid"
                        : "✗ Invalid"}
                      {rtmStatus.details.testLogin?.error && (
                        <span> - {rtmStatus.details.testLogin.error}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
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

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !verifying && setShowDisconnectModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              padding: "2rem",
              maxWidth: "32rem",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                marginBottom: "1rem",
              }}
            >
              Disconnect Remember The Milk
            </h3>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ marginBottom: "1rem", color: "#374151" }}>
                To disconnect safely, please follow these steps:
              </p>

              <div
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "1rem",
                  borderRadius: "0.375rem",
                  marginBottom: "1rem",
                }}
              >
                <p
                  style={{
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "#1f2937",
                  }}
                >
                  Step 1: Revoke Access on RTM
                </p>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#4b5563",
                    marginBottom: "0.75rem",
                  }}
                >
                  Visit the RTM website to revoke this app's access:
                </p>
                <a
                  href="https://www.rememberthemilk.com/app/#settings/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1rem",
                    backgroundColor: "#2563eb",
                    color: "white",
                    borderRadius: "0.375rem",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Open RTM Settings →
                </a>
              </div>

              <div
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "1rem",
                  borderRadius: "0.375rem",
                }}
              >
                <p
                  style={{
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "#1f2937",
                  }}
                >
                  Step 2: Complete Disconnect
                </p>
                <p style={{ fontSize: "0.875rem", color: "#4b5563" }}>
                  After revoking access on RTM, click the button below to verify
                  and complete the disconnect.
                </p>
              </div>

              {verifyError && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "0.375rem",
                    color: "#991b1b",
                    fontSize: "0.875rem",
                  }}
                >
                  {verifyError}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowDisconnectModal(false)}
                disabled={verifying}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: verifying ? "not-allowed" : "pointer",
                  opacity: verifying ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyDisconnect}
                disabled={verifying}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: verifying ? "#9ca3af" : "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: verifying ? "not-allowed" : "pointer",
                }}
              >
                {verifying ? "Verifying..." : "Verify & Complete Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
