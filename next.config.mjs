/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/*": ["./content/skills/**/*.md", "./content/skills/**/*.json"]
  }
};

export default nextConfig;
