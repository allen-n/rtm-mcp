import Image from "next/image";

const rtmAppsSettingsUrl = "https://www.rememberthemilk.com/app/#settings/apps";

type DisconnectGuideProps = {
  title?: string;
  description?: string;
  caption?: string;
};

export function DisconnectGuide({
  title = "Full disconnect (important)",
  description =
    "Disconnecting in milkbridge removes your token from milkbridge only. To fully revoke access, you must also revoke the app in RTM settings.",
  caption =
    "In RTM settings, open Apps and click Revoke access to complete disconnection.",
}: DisconnectGuideProps) {
  return (
    <section className="space-y-4 border rounded-lg p-5 bg-muted/30">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
      <ol className="list-decimal pl-5 space-y-2 text-sm">
        <li>Disconnect in the milkbridge dashboard.</li>
        <li>
          Open RTM Apps settings:{" "}
          <a
            href={rtmAppsSettingsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            {rtmAppsSettingsUrl}
          </a>
        </li>
        <li>
          Find milkbridge in the app list and click <strong>Revoke access</strong>.
        </li>
      </ol>
      <div className="space-y-2">
        <Image
          src="/docs/rtm-revoke-access.png"
          alt="Remember The Milk Apps settings showing the Revoke access button"
          className="w-full rounded-md border"
          width={1280}
          height={900}
          sizes="(max-width: 768px) 100vw, 896px"
        />
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
    </section>
  );
}
