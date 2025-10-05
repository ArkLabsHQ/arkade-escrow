// client/next.config.ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	experimental: {
		optimizePackageImports: [],
	},
	// Point file-tracing to the repo root to avoid the "inferred workspace root" warning
	outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
