import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Bicycle Records', short_name: 'Bicycle Records', start_url: '/', display: 'standalone', theme_color: '#2f6f4e', background_color: '#202522' } })],
})