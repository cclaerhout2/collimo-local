import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// planche.html (recette des dispositions) n'est servie qu'en développement, jamais publiée.
export default defineConfig({
  plugins: [react()],
})
