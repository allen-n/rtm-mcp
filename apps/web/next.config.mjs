/** @type {import('next').NextConfig} */
const isBuildCommand = process.argv.includes("build");

if (isBuildCommand) {
  const requiredBuildEnv = [
    "NEXT_PUBLIC_API_BASE",
    "NEXT_PUBLIC_SITE_URL",
    "API_BASE_INTERNAL",
  ];

  const missingBuildEnv = requiredBuildEnv.filter((name) => {
    const value = process.env[name];
    return !value || value.trim() === "";
  });

  if (missingBuildEnv.length > 0) {
    throw new Error(
      `Missing required build-time env vars: ${missingBuildEnv.join(
        ", ",
      )}. Set them before running next build.`,
    );
  }

  const urlBuildEnv = [
    "NEXT_PUBLIC_API_BASE",
    "NEXT_PUBLIC_SITE_URL",
    "API_BASE_INTERNAL",
  ];

  const invalidUrlEnv = urlBuildEnv.filter((name) => {
    try {
      const parsed = new URL(process.env[name]);
      return parsed.protocol !== "http:" && parsed.protocol !== "https:";
    } catch {
      return true;
    }
  });

  if (invalidUrlEnv.length > 0) {
    throw new Error(
      `Invalid URL format for build-time env vars: ${invalidUrlEnv.join(
        ", ",
      )}. Use absolute http(s) URLs.`,
    );
  }
}

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
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
      {
        source: "/rtm/:path*",
        destination: `${apiBase}/rtm/:path*`,
      },
      {
        source: "/llms.txt",
        destination: `${apiBase}/llms.txt`,
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
