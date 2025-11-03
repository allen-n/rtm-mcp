export const metadata = {
  title: 'MCP-RTM Portal',
  description: 'Connect your Remember The Milk account to use with AI assistants via MCP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
