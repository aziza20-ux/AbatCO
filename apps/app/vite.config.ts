import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CycleTrack',
        short_name: 'AbatCo',
        start_url: '/',
        display: 'standalone',
        theme_color: '#2f6f4e',
        background_color: '#202522',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    })],
  server: { host: true },
})