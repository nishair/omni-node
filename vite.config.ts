import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://nishair.github.io/omni-node/ on GitHub Pages.
  base: process.env.GITHUB_ACTIONS ? '/omni-node/' : '/',
})
