import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    allowedHosts: [
      'unrewarding-stridulous-deb.ngrok-free.dev',
      '*.ngrok-free.dev'
    ]
  }
})
