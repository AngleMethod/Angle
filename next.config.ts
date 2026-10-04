import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { '/api/certificates/**': ['./public/certificates/v1/**/*'], '/api/admin/certificates/**': ['./public/certificates/v1/**/*'], '/api/admin/certificates': ['./public/certificates/v1/**/*'] },
};

export default nextConfig;
