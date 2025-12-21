
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Removed custom 'define' block to prevent overwriting runtime environment variables like process.env.API_KEY.
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  }
});
