/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "kysely"],
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Enforce type checking during build (fail on errors)
    ignoreBuildErrors: false,
  },
  async rewrites() {
    // API_BASE_INTERNAL is the server-side URL for proxying (e.g. http://mcp:8787 in Docker,
    // or Railway private networking URL in prod). Falls back to NEXT_PUBLIC_API_BASE for
    // non-containerised local dev where the server is reachable on localhost.
    const apiBase =
      process.env.API_BASE_INTERNAL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      "http://localhost:8787";
    return [
      {
        source: "/api/auth/:path*",
        destination: `${apiBase}/api/auth/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark native modules as external for server-side builds
      config.externals = [...(config.externals || []), "pg"];
    }
    return config;
  },
};

export default nextConfig;
