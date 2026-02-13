import Link from "next/link";

export default function PlaybooksPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Playbooks</p>
        <h1 className="text-4xl font-bold tracking-tight">Operational playbooks for AI + RTM</h1>
        <p className="text-lg text-muted-foreground">
          Practical workflows you can apply immediately in milkbridge.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/playbooks/ai-collaborator-account"
          className="border rounded-lg p-5 hover:border-primary transition-colors space-y-2"
        >
          <h2 className="text-xl font-semibold">Dedicated AI collaborator account</h2>
          <p className="text-sm text-muted-foreground">
            Keep attribution clear by giving your AI assistant its own RTM account,
            sharing only relevant lists/tasks, and applying guardrails.
          </p>
          <p className="text-primary text-sm">Read playbook</p>
        </Link>
      </div>

      <section>
        <Link href="/docs/getting-started" className="text-primary hover:underline">
          Back to getting started
        </Link>
      </section>
    </div>
  );
}
