import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {vitePrerenderPlugin} from 'vite-prerender-plugin';
import path from 'path'

// brute force rešitev ker vitePrerenderPlugin ne zaključi procesa, sel gledat njihov github issues in bi naj bil react bug ki se za zdaj ni popravljen
function closePlugin() {
    return {
        name: 'close-plugin',
        closeBundle() {
            console.log('Build completed - forcing exit');
            process.exit(0);
        }
    }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vitePrerenderPlugin({
      renderTarget: '#root',
      prerenderScript: path.resolve('./src/main.jsx')
    }),
    closePlugin(),
  ],
})
