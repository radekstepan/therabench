import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import resultsLoaderPlugin from './src/vite-plugin-results-loader';

export default defineConfig({
  plugins: [react(), resultsLoaderPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Allow serving files from the eval-engine data directory
      allow: ['..'],
    },
  },
});
