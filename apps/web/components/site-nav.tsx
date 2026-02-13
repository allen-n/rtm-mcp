"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@auth/client";
import { Button } from "@/components/ui/button";

type SessionUser = {
  email?: string;
  name?: string;
};

export function SiteNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  function navClass(href: string) {
    const isActive =
      pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
    return isActive
      ? "text-foreground font-medium"
      : "hover:text-foreground text-muted-foreground";
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const session = await authClient.getSession();
        if (!mounted) return;
        setUser(session.data?.user ?? null);
      } catch (error) {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold tracking-tight">
            milkbridge
          </Link>
          <nav className="flex items-center gap-4 text-muted-foreground">
            <Link href="/docs/getting-started" className={navClass("/docs")}>
              Docs
            </Link>
            <Link href="/playbooks" className={navClass("/playbooks")}>
              Playbooks
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs text-muted-foreground">Checking session...</span>
          ) : user ? (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Signed in as {user.email || user.name || "user"}
              </span>
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm" variant="outline">
                Log in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
