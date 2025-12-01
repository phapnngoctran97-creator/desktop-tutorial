import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the application code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env': process.env
    },
    build: {
      outDir: 'dist',
    }
  };
});