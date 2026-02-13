"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiKeySection } from "./api-key-section";
import {
  LogOut,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  ListTodo,
} from "lucide-react";

// Public API URL shown to the user (MCP server URL, Claude config, etc.)
const publicApiBase =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";
const rtmAppsSettingsUrl = "https://www.rememberthemilk.com/app/#settings/apps";

type RtmStatus = "loading" | "connected" | "disconnected" | "error";

interface RtmConnection {
  status: RtmStatus;
  username?: string;
  fullname?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [rtmConnection, setRtmConnection] = useState<RtmConnection>({
    status: "loading",
  });
  const [copied, setCopied] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showFullDisconnectNotice, setShowFullDisconnectNotice] =
    useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const mcpUrl = `${publicApiBase}/mcp/json`;
  const llmsUrl = `${publicApiBase}/llms.txt`;
  const toolsUrl = `${publicApiBase}/api/v1/tools`;
  const skillsUrl = `${publicApiBase}/api/v1/skills.md`;
  const docsUrl = `${publicApiBase}/api/v1/docs`;
  const openApiUrl = `${publicApiBase}/api/v1/openapi.json`;
  const sharedConfig = `{
  "mcpServers": {
    "milkbridge": {
      "url": "${mcpUrl}",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}`;

  useEffect(() => {
    async function loadData() {
      // Load user session
      const session = await authClient.getSession();
      if (!session.data?.user) {
        router.push("/login");
        return;
      }
      setUser({
        name: session.data.user.name || "User",
        email: session.data.user.email || "",
      });

      // Check RTM connection status
      try {
        const res = await fetch("/rtm/status", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setRtmConnection({
              status: "connected",
              username: data.username,
              fullname: data.fullname,
            });
          } else {
            setRtmConnection({ status: "disconnected" });
          }
        } else {
          setRtmConnection({ status: "disconnected" });
        }
      } catch (error) {
        setRtmConnection({ status: "error" });
      }
    }

    loadData();
  }, [router]);

  async function handleLogout() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  async function handleConnectRtm() {
    setConnecting(true);
    try {
      window.location.href = "/rtm/start";
    } catch (error) {
      setConnecting(false);
    }
  }

  async function handleDisconnectRtm() {
    setDisconnectError(null);
    try {
      const res = await fetch("/rtm/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setRtmConnection({ status: "disconnected" });
        setShowFullDisconnectNotice(true);
      } else {
        const body = await res.json().catch(() => null);
        setDisconnectError(
          body?.error || `Failed to disconnect in milkbridge (${res.status}).`,
        );
      }
    } catch (error) {
      console.error("Failed to disconnect RTM:", error);
      setDisconnectError("Failed to disconnect in milkbridge.");
    }
  }

  function copyServerUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyConfig(config: string) {
    navigator.clipboard.writeText(config);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.name}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* RTM Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Remember The Milk</CardTitle>
                <CardDescription>
                  Connect your RTM account to use milkbridge
                </CardDescription>
              </div>
            </div>
            {rtmConnection.status === "connected" ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : rtmConnection.status === "loading" ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rtmConnection.status === "connected" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{rtmConnection.fullname}</p>
                  <p className="text-sm text-muted-foreground">
                    @{rtmConnection.username}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectRtm}
                >
                  Disconnect
                </Button>
              </div>
              {disconnectError ? (
                <Alert variant="destructive">
                  <AlertTitle>Disconnect failed</AlertTitle>
                  <AlertDescription>{disconnectError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : rtmConnection.status === "loading" ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {showFullDisconnectNotice ? (
                <Alert>
                  <AlertTitle>
                    Step 2 required: revoke access in Remember The Milk
                  </AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      You disconnected milkbridge locally. To fully remove app
                      access, revoke it on RTM Apps settings.
                    </p>
                    <div>
                      <a
                        href={rtmAppsSettingsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open RTM Apps settings
                      </a>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <Alert>
                <AlertTitle>Connect your RTM account</AlertTitle>
                <AlertDescription>
                  You need to authorize access to Remember The Milk to use the
                  MCP tools.
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnectRtm} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Remember The Milk
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {rtmConnection.status === "connected" || showFullDisconnectNotice ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>How to fully disconnect</CardTitle>
            <CardDescription>
              Disconnecting in milkbridge only removes your token from this app.
              You must also revoke access in RTM for complete removal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>1. Click Disconnect in the Remember The Milk connection card.</p>
            <p>2. Open RTM Apps settings.</p>
            <p>3. Click Revoke access for the milkbridge app.</p>
            <a
              href={rtmAppsSettingsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Go to RTM Apps settings
            </a>
          </CardContent>
        </Card>
      ) : null}

      {/* MCP Server Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>MCP Server Configuration</CardTitle>
          <CardDescription>
            Use these settings to connect your MCP client and review available
            API/MCP docs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Server URL</label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {mcpUrl}
              </code>
              <Button variant="outline" size="icon" onClick={copyServerUrl}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">
              Client Setup (Claude Desktop / Cursor / Cline / Roo Code /
              Windsurf / Continue)
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold">Shared JSON Config</p>
                    <p className="text-xs text-muted-foreground">
                      Use this for most MCP clients that accept JSON server
                      definitions.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyConfig(sharedConfig)}
                  >
                    {copiedConfig ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <pre className="text-xs overflow-x-auto">{sharedConfig}</pre>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold mb-3">Docs & API Reference</p>
                <div className="grid gap-2 text-sm">
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Swagger UI ({`${publicApiBase}/api/v1/docs`})
                  </a>
                  <a
                    href={openApiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    OpenAPI JSON ({`${publicApiBase}/api/v1/openapi.json`})
                  </a>
                  <a
                    href={llmsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    llms.txt (quick MCP usage guide)
                  </a>
                  <a
                    href={skillsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    skills.md (detailed AI agent usage)
                  </a>
                  <a
                    href={toolsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    /api/v1/tools (JSON tool schemas)
                  </a>
                  <p className="text-xs text-muted-foreground pt-1">
                    API invoke endpoint:{" "}
                    <code>{`${publicApiBase}/api/v1/invoke`}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <ApiKeySection />
    </div>
  );
}
