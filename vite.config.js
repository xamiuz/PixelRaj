import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js'],
          'lucide': ['lucide-svelte'],
        }
      }
    },
    chunkSizeWarningLimit: 700,
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'lucide-svelte']
  }
})

