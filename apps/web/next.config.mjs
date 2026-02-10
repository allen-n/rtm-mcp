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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark native modules as external for server-side builds
      config.externals = [...(config.externals || []), "pg"];
    }
    return config;
  },
};

export default nextConfig;
