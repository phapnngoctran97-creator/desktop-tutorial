
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file từ thư mục gốc, đồng thời lấy từ process.env của hệ thống (Cloudflare)
  const env = loadEnv(mode, process.cwd(), '');
  
  // Cloudflare Pages sử dụng process.env trong quá trình build
  const apiKey = env.API_KEY || process.env.API_KEY || '';
  
  return {
    plugins: [react()],
    define: {
      // Thay thế process.env.API_KEY bằng giá trị thực tế trong code client
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    server: {
      port: 3000
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    }
  };
});
