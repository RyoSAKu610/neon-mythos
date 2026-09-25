/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@neon/domain",
    "@neon/contracts",
    "@neon/db",
    "@neon/ui",
    "@neon/observability",
    "@neon/agents",
    "@neon/tools",
    "@neon/ai-core",
  ],
};
export default nextConfig;
