import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};
export default config;
