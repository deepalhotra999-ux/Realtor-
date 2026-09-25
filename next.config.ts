import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Listing photos upload through a Server Action (default limit is 1 MB).
      // Per-file (8 MB) and per-batch limits are enforced in the action and UI.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
