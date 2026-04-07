import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return null;
          if (id.includes('pdfjs-dist')) {
            return 'pdf-vendor';
          }
          if (id.includes('@supabase') || id.includes('firebase')) {
            return 'backend-vendor';
          }
          if (id.includes('jspdf') || id.includes('xlsx') || id.includes('html2canvas')) {
            return 'export-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
