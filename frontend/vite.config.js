import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    build: {
      rollupOptions: {
        input: {
          auth: resolve(__dirname, "auth.html"),
          dashboard: resolve(__dirname, "dashboard.html"),
          reset: resolve(__dirname, "reset.html"),
        },
      },
    },
    server: {
      allowedHosts: [env.VITE_DOMAIN],
      proxy: {
        '/auth-api': {
          target: env.VITE_AUTH_URL || 'http://localhost:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/auth-api/, '/api'),
        },
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
      hmr: {
        host: env.VITE_DOMAIN,
        protocol: "wss",
        clientPort: 443,
      },
    },
  };
});