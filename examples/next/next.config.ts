import type { NextConfig } from 'next';
import { withSwaggerz } from 'swaggerz/next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Generates src/generated/api from openapi.yaml: when `next dev` starts and again whenever the
// specification or swaggerz.config.ts changes, and before `next build`.
export default withSwaggerz(nextConfig);
