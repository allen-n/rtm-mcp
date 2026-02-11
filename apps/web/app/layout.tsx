import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const metadataBase = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "Remember The Milk MCP Server",
  description:
    "Connect Remember The Milk to Claude and other AI assistants via MCP",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "Remember The Milk",
    "MCP",
    "Model Context Protocol",
    "Claude",
    "AI assistants",
    "tasks integration",
    "automation",
  ],
  openGraph: {
    title: "Remember The Milk MCP Server",
    description:
      "Connect Remember The Milk to Claude and other AI assistants via MCP",
    type: "website",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Remember The Milk MCP Server",
    description:
      "Connect Remember The Milk to Claude and other AI assistants via MCP",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
