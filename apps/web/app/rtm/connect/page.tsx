"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  ListTodo,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function RtmConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      <div className="container max-w-3xl py-12">
        <Card className="border-destructive/40">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              We couldn&apos;t start the RTM authorization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Details</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button
                variant="destructive"
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

  if (!authUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Preparing your authorization link...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-12 space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <ListTodo className="h-4 w-4" />
          Remember The Milk
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Connect Remember The Milk
        </h1>
        <p className="text-muted-foreground">
          Follow the quick two-step flow to authorize your account and finish
          setup.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                Step 1: Authorize on RTM
              </CardTitle>
              <CardDescription>
                Open Remember The Milk in a new tab and grant access to this
                application.
              </CardDescription>
            </div>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild>
              <a href={authUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Remember The Milk
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              A new window will open so you can confirm access.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Step 2: Finish connection</CardTitle>
            <CardDescription>
              After you&apos;ve authorized RTM, return here to complete setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleComplete} className="w-full sm:w-auto">
              I&apos;ve authorized - complete setup
            </Button>
            <p className="text-sm text-muted-foreground">
              We&apos;ll verify your authorization and link your account.
            </p>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Need a tip?</AlertTitle>
          <AlertDescription>
            Keep this tab open while you authorize in RTM. Once you&apos;re
            done, click "complete setup" to finish connecting.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default function RtmConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <RtmConnectContent />
    </Suspense>
  );
}
