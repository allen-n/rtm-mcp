export default function Page() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

  return (
    <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", marginBottom: "1rem" }}>
        MCP-RTM Portal
      </h1>
      <p style={{ marginBottom: "1.5rem" }}>
        Connect your Remember The Milk account to use it with AI assistants via MCP.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <a
          href={`${apiBase}/rtm/start`}
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            textAlign: "center"
          }}
        >
          Connect Remember The Milk
        </a>

        <div style={{ fontSize: "0.875rem", color: "#4b5563" }}>
          <p>Already connected? Check your connection status in your account settings.</p>
        </div>
      </div>
    </main>
  );
}
