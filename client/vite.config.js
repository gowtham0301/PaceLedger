
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return

          if (
            /\/node_modules\/(react|react-dom|react-is|scheduler|use-sync-external-store)\//.test(id)
          ) {
            return 'react-vendor'
          }

          if (
            /\/node_modules\/(recharts|victory-vendor|d3-[^/]+|@reduxjs|redux|redux-thunk|react-redux|reselect|immer|es-toolkit|decimal\.js-light|internmap|eventemitter3|tiny-invariant)\//.test(id)
          ) {
            return 'charts-vendor'
          }
        },
      },
    },
  },
})
