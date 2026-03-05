import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // Source - https://stackoverflow.com/a/79377387
    // Posted by ansmonjol, modified by community. See post 'Timeline' for change history
    // Retrieved 2026-03-02, License - CC BY-SA 4.0
    server: {
      allowedHosts: [env.VITE_DOMAIN],
    },
  }
})
