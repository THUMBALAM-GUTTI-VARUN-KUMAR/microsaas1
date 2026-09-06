import clerk from '@clerk/astro';
// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Always use Node adapter in dev (Cloudflare adapter is incompatible with Vite dep optimizer).
// For production, `npm run build` uses Cloudflare. Set USE_NODE_ADAPTER=true to force Node in build.
const isDev = process.env.NODE_ENV !== 'production';
const useNode = isDev || process.env.USE_NODE_ADAPTER === 'true';

// https://astro.build/config
export default defineConfig({
  integrations: [clerk()],
  output: 'server',
  adapter: useNode ? node({ mode: 'standalone' }) : cloudflare({ imageService: 'cloudflare' }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@clerk/astro', '@clerk/astro/server', '@clerk/astro/components']
    },
    ssr: {
      noExternal: ['@clerk/astro']
    }
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'ja', 'fr', 'de', 'pt', 'ko', 'it'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});