import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load các biến môi trường
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Định nghĩa process.env.API_KEY để code React hiểu được
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})