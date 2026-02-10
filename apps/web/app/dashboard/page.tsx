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

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8787";

type RtmStatus = "loading" | "connected" | "disconnected" | "error";

interface RtmConnection {
  status: RtmStatus;
  username?: string;
  fullname?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [rtmConnection, setRtmConnection] = useState<RtmConnection>({
    status: "loading",
  });
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
        const res = await fetch(`${apiBase}/rtm/status`, {
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
    router.push("/");
  }

  async function handleConnectRtm() {
    setConnecting(true);
    try {
      window.location.href = `${apiBase}/rtm/start`;
    } catch (error) {
      setConnecting(false);
    }
  }

  async function handleDisconnectRtm() {
    try {
      const res = await fetch(`${apiBase}/rtm/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setRtmConnection({ status: "disconnected" });
      }
    } catch (error) {
      console.error("Failed to disconnect RTM:", error);
    }
  }

  function copyServerUrl() {
    navigator.clipboard.writeText(`${apiBase}/mcp/json`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <p className="text-muted-foreground">
            Welcome back, {user.name}
          </p>
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
                  Connect your RTM account to use the MCP server
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
            </div>
          ) : rtmConnection.status === "loading" ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
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

      {/* MCP Server Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>MCP Server Configuration</CardTitle>
          <CardDescription>
            Use these settings to connect your MCP client (Claude Desktop,
            Cursor, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Server URL</label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {apiBase}/mcp/json
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

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Claude Desktop Config</p>
            <pre className="text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "rtm": {
      "url": "${apiBase}/mcp/json",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <ApiKeySection />
    </div>
  );
}
