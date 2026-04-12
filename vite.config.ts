import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['padel-icon.svg'],
      manifest: {
        name: 'Padel Parade',
        short_name: 'Padel Parade',
        description: 'A sporty Americano and Mexicano padel tournament board for iPad.',
        theme_color: '#141210',
        background_color: '#141210',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          {
            src: 'padel-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
