"use client";
import { authClient } from "@auth/client";
import type { Apikey } from "@db/schema";
import React, { useState, useEffect } from "react";

// type Apikey = {
//   id: string;
//   name: string;
//   key?: string; // Only present when first created
//   createdAt: string;
//   expiresAt: string | null;
//   lastUsedAt: string | null;
// };

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";

export function ApiKeySection() {
  const [apiKeys, setApiKeys] = useState<Apikey[]>([]);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<Apikey | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      const res = await fetch(`${apiBase}/api/auth/api-key/list`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Fetched API keys:", data);
        setApiKeys(data || []);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      alert("Please enter a name for the API key");
      return;
    }

    setCreatingKey(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/api-key/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          prefix: "rtm-mcp-",
          // No expiration by default
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data);
        setNewKeyName("");
        await loadApiKeys();
      } else {
        const error = await res.json();
        alert(`Failed to create API key: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    if (
      !confirm(
        "Are you sure you want to delete this API key? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingKeyId(keyId);
    try {
      // TODO: prefer and migrate to using authClient
      const { data, error } = await authClient.apiKey.delete({ keyId });

      if (data?.success) {
        await loadApiKeys();
      } else {
        const err = error || { message: "Unknown error" };
        alert(`Failed to delete API key: ${err.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    } finally {
      setDeletingKeyId(null);
    }
  }

  function handleCopyKey(key: string, keyId: string) {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  function closeCreatedKeyModal() {
    setCreatedKey(null);
    setShowCreateKeyModal(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#f9fafb",
        padding: "1.5rem",
        borderRadius: "0.5rem",
        marginTop: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
          }}
        >
          MCP API Keys
        </h2>
        <button
          onClick={() => setShowCreateKeyModal(true)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: "500",
          }}
        >
          Create API Key
        </button>
      </div>

      <p
        style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}
      >
        Create API keys to authenticate your MCP client (Claude Desktop) with
        this server.
      </p>

      {apiKeys.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#9ca3af",
            backgroundColor: "white",
            borderRadius: "0.375rem",
            border: "2px dashed #d1d5db",
          }}
        >
          No API keys created yet. Click "Create API Key" to get started.
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {apiKeys.map((key) => (
            <div
              key={key.id}
              style={{
                backgroundColor: "white",
                padding: "1rem",
                borderRadius: "0.375rem",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                    {key.name}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    Created: {new Date(key.createdAt).toLocaleDateString()},
                    Requests made: {key.requestCount}
                  </p>
                  {key.lastRequest && (
                    <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Last used:{" "}
                      {new Date(key.lastRequest).toLocaleDateString()}
                    </p>
                  )}
                  {key.expiresAt ? (
                    <p style={{ fontSize: "0.75rem", color: "#dc2626" }}>
                      Expires: {new Date(key.expiresAt).toLocaleDateString()}
                    </p>
                  ) : (
                    <p style={{ fontSize: "0.75rem", color: "#10b981" }}>
                      No Expiration
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  disabled={deletingKeyId === key.id}
                  style={{
                    padding: "0.375rem 0.75rem",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor:
                      deletingKeyId === key.id ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    opacity: deletingKeyId === key.id ? 0.5 : 1,
                  }}
                >
                  {deletingKeyId === key.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateKeyModal && !createdKey && (
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
          onClick={() => !creatingKey && setShowCreateKeyModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              padding: "2rem",
              maxWidth: "28rem",
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
              Create API Key
            </h3>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Claude Desktop"
                disabled={creatingKey}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
              />
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "0.25rem",
                }}
              >
                Choose a descriptive name to identify where this key is used
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowCreateKeyModal(false)}
                disabled={creatingKey}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: creatingKey ? "not-allowed" : "pointer",
                  opacity: creatingKey ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor:
                    creatingKey || !newKeyName.trim() ? "#9ca3af" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor:
                    creatingKey || !newKeyName.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {creatingKey ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Key Display Modal */}
      {createdKey && (
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
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              padding: "2rem",
              maxWidth: "36rem",
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
              API Key Created
            </h3>

            <div
              style={{
                backgroundColor: "#fef3c7",
                padding: "1rem",
                borderRadius: "0.375rem",
                marginBottom: "1rem",
                border: "1px solid #fde047",
              }}
            >
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#92400e",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                }}
              >
                ⚠️ Important: Save this key now!
              </p>
              <p style={{ fontSize: "0.875rem", color: "#78350f" }}>
                This is the only time you'll see this key. Store it somewhere
                safe.
              </p>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Your API Key
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                  }}
                >
                  {createdKey.key}
                </code>
                <button
                  onClick={() => handleCopyKey(createdKey.key!, createdKey.id)}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor:
                      copiedKeyId === createdKey.id ? "#10b981" : "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedKeyId === createdKey.id ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f3f4f6",
                padding: "1rem",
                borderRadius: "0.375rem",
                marginBottom: "1.5rem",
              }}
            >
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "#1f2937",
                }}
              >
                Next Steps:
              </p>
              <ol
                style={{
                  fontSize: "0.875rem",
                  color: "#4b5563",
                  paddingLeft: "1.25rem",
                }}
              >
                <li style={{ marginBottom: "0.25rem" }}>
                  Copy the API key above
                </li>
                <li style={{ marginBottom: "0.25rem" }}>
                  Configure your MCP client (see documentation)
                </li>
                <li>Keep the key secure - treat it like a password</li>
              </ol>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={closeCreatedKeyModal}
                style={{
                  padding: "0.5rem 1.5rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
