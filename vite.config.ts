import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // You need to import 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()], // Added the react plugin
  
  // Your server settings:
  server: {
    host: "::",
    port: 8080,
  },

  // Your resolve/alias settings:
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // --- THE FIX ---
  // This is the fix for the blank page and 'supabaseUrl' error.
  build: {
    target: 'es2020' 
  }
  // -----------------
}));