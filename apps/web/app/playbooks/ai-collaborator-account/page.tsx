import Link from "next/link";

export default function AiCollaboratorAccountPlaybookPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Playbook</p>
        <h1 className="text-4xl font-bold tracking-tight">Dedicated AI collaborator account</h1>
        <p className="text-lg text-muted-foreground">
          Use a separate RTM identity for your AI assistant so collaboration is
          explicit, traceable, and easier to manage safely.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Why this model works</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Clear attribution: assistant notes and actions come from its own account.</li>
          <li>Tighter control: share only lists/projects where assistance is needed.</li>
          <li>Safer defaults: keep destructive actions disabled unless explicitly approved.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Suggested setup</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Create a separate RTM account for the assistant.</li>
          <li>Connect that account in milkbridge and generate an API key.</li>
          <li>Share only selected lists/tasks with the assistant account.</li>
          <li>Use assignment and/or a dedicated tag to route work.</li>
          <li>Require summary updates and keep a conservative guardrail policy.</li>
        </ol>
      </section>

      <section className="space-y-3 border rounded-lg p-5 bg-muted/30">
        <h2 className="text-2xl font-semibold">Guardrails</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Default to research and notes only.</li>
          <li>Do not complete/delete tasks unless explicit permission is granted.</li>
          <li>Respect ownership and list boundaries.</li>
          <li>Operate on tagged or assigned tasks first; use list scan for context only.</li>
        </ul>
      </section>

      <section className="space-y-4 border rounded-lg p-5 bg-muted/30">
        <h2 className="text-2xl font-semibold">Full disconnect (important)</h2>
        <p className="text-muted-foreground">
          Disconnecting in milkbridge is only step 1. To fully remove access,
          revoke the app in RTM settings.
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Disconnect in milkbridge dashboard.</li>
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
          <li>Click <strong>Revoke access</strong> for milkbridge.</li>
        </ol>
        <div className="space-y-2">
          <img
            src="/docs/rtm-revoke-access.png"
            alt="Remember The Milk Apps settings showing the Revoke access button"
            className="w-full rounded-md border"
          />
          <p className="text-xs text-muted-foreground">
            This is the final step required for full revocation.
          </p>
        </div>
      </section>

      <section>
        <Link href="/playbooks" className="text-primary hover:underline">
          Back to playbooks
        </Link>
      </section>
    </div>
  );
}
