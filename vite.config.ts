import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // File watching is disabled when HMR is explicitly turned off.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    optimizeDeps: {
      exclude: ['esbuild', 'lightningcss', 'tsx']
    },
    ssr: {
      noExternal: ['esbuild', 'lightningcss']
    },
    build: {
      // Increase warning limit and add manual chunking to keep bundle sizes reasonable
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        // Keep large vendor libraries in separate chunks
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            const parts = id.split('node_modules/')[1].split('/');
            let pkg = parts[0];
            if (pkg.startsWith('@') && parts.length > 1) {
              pkg = `${pkg}/${parts[1]}`;
            }
            return `vendor_${pkg.replace('@', '').replace('/', '_')}`;
          }
        },
        // Externalize native build tools that should not be bundled into the browser app
        external: ['esbuild', 'lightningcss']
      }
    }
  };
});
