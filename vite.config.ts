/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// The 3D game pulls in several large, rarely-changing vendor libraries (three,
// rapier physics, drei/fiber, firebase). Bundled together they produced a single
// ~3MB "engine" chunk that the browser had to re-download on every deploy and
// could not cache independently. We split them into stable, separately-cacheable
// vendor chunks via manualChunks so a change in app code (or in one vendor)
// doesn't bust the cache for the others.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Order matters: match the more specific physics/3D libs before the
          // generic `three` substring, and keep fiber/drei together so their
          // shared reconciler internals land in one chunk.
          if (id.includes('@react-three/rapier') || id.includes('@dimforge')) {
            return 'rapier'
          }
          if (id.includes('@react-three/drei') || id.includes('@react-three/fiber')) {
            return 'drei'
          }
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'firebase'
          }
          if (id.includes('three')) {
            return 'three'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
  },
})
