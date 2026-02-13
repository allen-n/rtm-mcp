import Link from "next/link";

export default function GettingStartedPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Docs</p>
        <h1 className="text-4xl font-bold tracking-tight">Getting Started with milkbridge</h1>
        <p className="text-lg text-muted-foreground">
          Connect Remember The Milk to your AI agents with clear ownership,
          safe guardrails, and predictable workflows.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Create your milkbridge account</h2>
        <p className="text-muted-foreground">
          Sign in, then open your dashboard to connect Remember The Milk and generate an API key.
        </p>
        <Link href="/login" className="text-primary hover:underline">
          Go to login
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">2. Connect Remember The Milk</h2>
        <p className="text-muted-foreground">
          Use the RTM connect flow in your dashboard and approve app access in RTM.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">3. Create an API key and configure your agent</h2>
        <p className="text-muted-foreground">
          Use the dashboard config block to connect Claude Desktop, Cursor, or any compatible MCP client.
        </p>
      </section>

      <section className="space-y-4 border rounded-lg p-5 bg-muted/30">
        <h2 className="text-2xl font-semibold">Full disconnect (important)</h2>
        <p className="text-muted-foreground">
          Disconnecting in milkbridge removes your token from milkbridge only.
          To fully revoke access, you must also revoke the app in RTM settings.
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Disconnect in the milkbridge dashboard.</li>
          <li>
            Open RTM Apps settings: {" "}
            <a
              href="https://www.rememberthemilk.com/app/#settings/apps"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              https://www.rememberthemilk.com/app/#settings/apps
            </a>
          </li>
          <li>Find milkbridge in the app list and click <strong>Revoke access</strong>.</li>
        </ol>
        <div className="space-y-2">
          <img
            src="/docs/rtm-revoke-access.png"
            alt="Remember The Milk Apps settings showing the Revoke access button"
            className="w-full rounded-md border"
          />
          <p className="text-xs text-muted-foreground">
            In RTM settings, open Apps and click Revoke access to complete disconnection.
          </p>
        </div>
      </section>

      <section>
        <Link href="/playbooks" className="text-primary hover:underline">
          Continue to playbooks
        </Link>
      </section>
    </div>
  );
}
