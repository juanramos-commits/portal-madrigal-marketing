import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 10_000,
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // vendor-react: core React + router
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/react-router') ||
            id.includes('/scheduler/')
          ) return 'vendor-react'

          // vendor-supabase
          if (id.includes('/@supabase/')) return 'vendor-supabase'

          // vendor-charts: recharts + d3 deps
          if (
            id.includes('/recharts/') ||
            id.includes('/d3-') ||
            id.includes('/victory-vendor/')
          ) return 'vendor-charts'

          // vendor-grid: react-grid-layout + dependencies
          if (
            id.includes('/react-grid-layout/') ||
            id.includes('/react-draggable/') ||
            id.includes('/react-resizable/')
          ) return 'vendor-grid'

          // vendor-dnd: @dnd-kit/*
          if (id.includes('/@dnd-kit/')) return 'vendor-dnd'

          // vendor-export: jspdf, file-saver, jszip, papaparse, html2canvas
          if (
            id.includes('/jspdf/') ||
            id.includes('/file-saver/') ||
            id.includes('/jszip/') ||
            id.includes('/papaparse/') ||
            id.includes('/html2canvas/')
          ) return 'vendor-export'
        },
      },
    },
  },
})
