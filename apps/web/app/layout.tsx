import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const metadataBase = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "milkbridge",
  description:
    "Bridge Remember The Milk and your AI agents so they can collaborate on tasks and get work done.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "Remember The Milk",
    "MCP",
    "Model Context Protocol",
    "milkbridge",
    "Claude",
    "AI assistants",
    "tasks integration",
    "automation",
  ],
  openGraph: {
    title: "milkbridge",
    description:
      "Bridge Remember The Milk and your AI agents so they can collaborate on tasks and get work done.",
    type: "website",
    images: ["/og/milkbridge-og-v1.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "milkbridge",
    description:
      "Bridge Remember The Milk and your AI agents so they can collaborate on tasks and get work done.",
    images: ["/og/milkbridge-og-v1.png"],
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
