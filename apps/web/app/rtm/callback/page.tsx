"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RtmCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    async function completeAuth() {
      try {
        const res = await fetch("/rtm/complete", {
          credentials: "include",
        });

        if (res.ok) {
          setStatus("success");
        } else {
          const text = await res.text();
          setError(text || "Failed to complete authorization");
          setStatus("error");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to complete authorization",
        );
        setStatus("error");
      }
    }

    completeAuth();
  }, []);

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    setSecondsRemaining(5);
    const redirectTimer = setTimeout(() => {
      router.push("/dashboard");
    }, 5000);

    const countdownTimer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(redirectTimer);
      clearInterval(countdownTimer);
    };
  }, [status, router]);

  const handleGoHome = () => {
    router.push("/dashboard");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium">
              Completing authorization with Remember The Milk...
            </p>
            <p className="text-sm text-muted-foreground">
              This should only take a moment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container max-w-xl py-12">
        <Card className="border-destructive/40">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-6 w-6" />
            </div>
            <CardTitle>Connection failed</CardTitle>
            <CardDescription>
              We couldn&apos;t finish linking your RTM account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertTitle>Details</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="destructive" onClick={handleGoHome}>
                Return to dashboard
              </Button>
              <Button variant="outline" onClick={() => router.push("/rtm/start")}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-xl py-12">
      <Card className="border-green-200 bg-green-50/70 text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-50">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600/10 text-green-700 dark:text-green-200">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>Connected to Remember The Milk</CardTitle>
          <CardDescription className="text-green-800/80 dark:text-green-100/70">
            Your account is linked. You can start using milkbridge now.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleGoHome}>Go to dashboard now</Button>
            <p className="text-sm text-green-800/80 dark:text-green-100/70">
              Redirecting automatically in {secondsRemaining}s...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
