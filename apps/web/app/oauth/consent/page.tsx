"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@auth/client";
import { getOAuthRedirectUrl } from "@/lib/oauth";
import { AlertTriangle, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PublicClient = {
  clientId?: string;
  name?: string | null;
  uri?: string | null;
  icon?: string | null;
};

function OAuthConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");
  const requestedScopes = useMemo(
    () =>
      (searchParams.get("scope") || "mcp:access").split(/\s+/).filter(Boolean),
    [searchParams],
  );
  const [client, setClient] = useState<PublicClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"accept" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      const session = await authClient.getSession();
      if (!session.data?.user) {
        const query = searchParams.toString();
        router.replace(query ? `/login?${query}` : "/login");
        return;
      }

      if (!clientId) {
        setError("Missing OAuth client.");
        setLoading(false);
        return;
      }

      const result = await authClient.oauth2.publicClient({
        query: { client_id: clientId },
      });

      if (result.error) {
        setError(result.error.message || "Could not load OAuth client.");
      } else {
        setClient(result.data as PublicClient);
      }
      setLoading(false);
    }

    loadClient();
  }, [clientId, router, searchParams]);

  async function submitConsent(accept: boolean) {
    setSubmitting(accept ? "accept" : "deny");
    setError(null);

    const result = await authClient.oauth2.consent({ accept });
    if (result.error) {
      setError(result.error.message || "Could not complete authorization.");
      setSubmitting(null);
      return;
    }

    const redirectUrl = getOAuthRedirectUrl(result.data);
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    setError("Authorization completed without a redirect URL.");
    setSubmitting(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading authorization request...
          </p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="container max-w-xl py-12">
        <Card className="border-destructive/40">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle>Authorization failed</CardTitle>
            <CardDescription>
              We couldn&apos;t load this OAuth request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Details</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Return to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = client?.name || client?.clientId || clientId;

  return (
    <div className="container max-w-xl py-12">
      <Card>
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle>Authorize MCP access</CardTitle>
            <CardDescription>
              {clientName} wants to connect to your milkbridge MCP server.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Requested access</p>
              <div className="flex flex-wrap gap-2">
                {requestedScopes.map((scope) => (
                  <Badge key={scope} variant="secondary">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Authorization failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => submitConsent(false)}
              disabled={submitting !== null}
            >
              {submitting === "deny" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Deny
            </Button>
            <Button
              onClick={() => submitConsent(true)}
              disabled={submitting !== null}
            >
              {submitting === "accept" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Authorize
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OAuthConsentContent />
    </Suspense>
  );
}
