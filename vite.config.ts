import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// the latest commits, baked into the build so the app can say what changed since you last opened it
function recentChanges(): { id: string; text: string }[] {
  try {
    return execSync('git log -n 25 --no-merges --pretty=format:%h%x09%s', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(l => { const [id, ...t] = l.split('\t'); return { id, text: t.join('\t').trim() } }).filter(c => c.id && c.text)
  } catch { return [] }
}
const changes = recentChanges()

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths, so it works from a sub-folder such as GitHub Pages
  plugins: [react()],
  // 127.0.0.1 (not "localhost", which Vite binds to ::1 only) so Firefox and other IPv4 clients can reach the dev server
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(changes[0]?.id ?? ''), __CHANGES__: JSON.stringify(changes) },
  build: {
    rollupOptions: {
      output: {
        // big libraries get their own files, so a normal app update does not make everyone re-download them
        manualChunks(id: string) {
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react'
        },
      },
    },
  },
})
