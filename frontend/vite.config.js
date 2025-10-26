import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import express from 'express'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-images',
      configurePreviewServer(server) {
        // Dynamically serve /app/images folder during preview
        const app = server.middlewares
        app.use(
          '/images',
          express.static('/app/images', {
            setHeaders: (res) => {
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
              res.setHeader('Pragma', 'no-cache')
              res.setHeader('Expires', '0')
            },
          })
        )
      },
    },
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['dndwiki.calebdee.io'],
    proxy: {
      '/api': {
        target: 'http://wiki-backend:8085',
        changeOrigin: true,
      },
    },
    fs: {
      allow: [
        resolve(__dirname, 'public'),
        '/app/images', // Mount path inside the container
        '/usr/share/nginx/html/images', // Optional Synology fallback
      ],
    },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['dndwiki.calebdee.io'],
  },
})
