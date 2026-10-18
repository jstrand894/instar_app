import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths, so it works from a sub-folder such as GitHub Pages
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
