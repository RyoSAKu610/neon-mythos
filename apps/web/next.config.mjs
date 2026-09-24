/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@neon/domain", "@neon/contracts", "@neon/db", "@neon/ui", "@neon/observability"],
};
export default nextConfig;
