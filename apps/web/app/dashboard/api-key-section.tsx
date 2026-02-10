"use client";

import { useState, useEffect } from "react";
import { authClient } from "@auth/client";
import type { Apikey } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";

export function ApiKeySection() {
  const [apiKeys, setApiKeys] = useState<Apikey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreatedKeyDialog, setShowCreatedKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<Apikey | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        setApiKeys(data || []);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/api-key/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          prefix: "rtm-mcp-",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data);
        setNewKeyName("");
        setShowCreateDialog(false);
        setShowCreatedKeyDialog(true);
        await loadApiKeys();
      } else {
        const error = await res.json();
        alert(`Failed to create API key: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    if (!confirm("Are you sure you want to delete this API key? This cannot be undone.")) {
      return;
    }

    setDeletingId(keyId);
    try {
      const { data, error } = await authClient.apiKey.delete({ keyId });
      if (data?.success) {
        await loadApiKeys();
      } else {
        alert(`Failed to delete API key: ${error?.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    } finally {
      setDeletingId(null);
    }
  }

  function copyToClipboard(text: string, keyId: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(keyId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatDate(date: string | Date | null) {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-xl">API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for MCP client authentication
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No API keys yet. Create one to authenticate your MCP client.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{key.name || "Unnamed"}</span>
                      {key.enabled === false && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatDate(key.createdAt)}
                      </span>
                      {key.lastRequest && (
                        <span>Last used {formatDate(key.lastRequest)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={deletingId === key.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingId === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your API key a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Key Name</label>
            <Input
              placeholder="e.g., Claude Desktop, Cursor"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateKey();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Key Dialog */}
      <Dialog open={showCreatedKeyDialog} onOpenChange={setShowCreatedKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Make sure to copy your API key now. For security reasons, it
                won't be shown again.
              </AlertDescription>
            </Alert>
            <label className="text-sm font-medium mb-2 block">Your API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all">
                {createdKey?.key}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  createdKey?.key &&
                  copyToClipboard(createdKey.key, createdKey.id)
                }
              >
                {copiedId === createdKey?.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCreatedKeyDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
