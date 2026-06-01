/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Next does not walk up to the monorepo root
  // (which contains another lockfile).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
