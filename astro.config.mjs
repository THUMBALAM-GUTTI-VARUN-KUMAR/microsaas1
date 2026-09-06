import clerk from '@clerk/astro';
// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

const useNode = process.env.USE_NODE_ADAPTER === 'true';

// https://astro.build/config
export default defineConfig({
  integrations: [clerk()],
  output: 'server',
  adapter: useNode ? node({ mode: 'standalone' }) : cloudflare({ imageService: 'cloudflare' }),
  vite: {
    plugins: [tailwindcss()]
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'ja', 'fr', 'de', 'pt', 'ko', 'it'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});