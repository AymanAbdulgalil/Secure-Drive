import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    server: {
      allowedHosts: [env.VITE_DOMAIN],
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
      hmr: {
        host: env.VITE_DOMAIN,
        protocol: "wss", // cloudflare tunnel is always HTTPS/WSS
        clientPort: 443, // tunnel terminates SSL, so client connects on 443
      },
    },
  };
});
