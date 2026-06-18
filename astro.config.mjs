// @ts-check
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://dev-bishal.github.io',
    base: '/CodeMastery',
    vite: {
        plugins: [tailwindcss()],
    },
    image: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.github.io',     // Matches all GitHub Pages subdomains
            },
            {
                protocol: 'https',
                hostname: 'raw.githubusercontent.com', // For raw image URLs
            },
            {
                protocol: 'https',
                hostname: 'secureurl.github.io',   // Specific user's GitHub Pages
            },
            {
                protocol: 'https',
                hostname: '**.netlify.app',   // If you also use Netlify
            },
        ]
    },

    integrations: [sitemap()],
});