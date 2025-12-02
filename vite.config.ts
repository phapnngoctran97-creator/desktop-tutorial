import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Inject the specific API KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env as an empty object to prevent "process is not defined" crashes
      // in third-party libraries, but DO NOT pass the actual process.env object
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
    }
  };
});