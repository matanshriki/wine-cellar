import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * After build: inject hashed /assets/* entry CSS/JS (and modulepreload) into sw.js precache
 * so offline loads work. Without this, only index.html is cached and the app is unstyled.
 */
function injectServiceWorkerPrecache() {
  return {
    name: 'inject-service-worker-precache',
    closeBundle() {
      const dist = path.join(__dirname, 'dist');
      const htmlPath = path.join(dist, 'index.html');
      const swOut = path.join(dist, 'sw.js');
      const swSrc = path.join(__dirname, 'public', 'sw.js');

      if (!fs.existsSync(htmlPath) || !fs.existsSync(swSrc)) {
        return;
      }

      const html = fs.readFileSync(htmlPath, 'utf8');
      const urls = new Set<string>();

      urls.add('/');
      urls.add('/index.html');
      urls.add('/manifest.json');
      urls.add('/favicon.ico');
      urls.add('/icon-192.png');
      urls.add('/icon-512.png');
      urls.add('/apple-touch-icon.png');
      urls.add('/wine.svg');

      const attrRe = /(?:href|src)="(\/assets\/[^"]+)"/g;
      let m;
      while ((m = attrRe.exec(html))) {
        urls.add(m[1]);
      }

      const revision = crypto.createHash('md5').update(html).digest('hex').slice(0, 10);
      const cacheName = `wine-cellar-precache-${revision}`;

      let sw = fs.readFileSync(swSrc, 'utf8');
      sw = sw.replace(/const CACHE_NAME = '[^']*'/, `const CACHE_NAME = '${cacheName}'`);
      sw = sw.replace(
        /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
        `const PRECACHE_ASSETS = ${JSON.stringify([...urls].sort(), null, 2)};`
      );

      fs.writeFileSync(swOut, sw);
      console.log(
        `[inject-service-worker-precache] ${cacheName}: ${urls.size} URLs (incl. entry assets)`
      );
    },
  };
}

// Only upload source maps when SENTRY_AUTH_TOKEN is present (CI / Vercel builds)
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryPluginEnabled = !!(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  const plugins = [
    react(),
    injectServiceWorkerPrecache(),
    // Upload source maps to Sentry after production builds only
    ...(sentryPluginEnabled && isProduction
      ? [
          sentryVitePlugin({
            org: sentryOrg,
            project: sentryProject,
            authToken: sentryAuthToken,
            sourcemaps: {
              // Delete local source map files after upload so they are not
              // shipped to users or included in the Vercel deployment.
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
            telemetry: false,
          }),
        ]
      : []),
  ];

  return {
  plugins,
  build: {
    // Generate source maps for production builds (uploaded to Sentry, then deleted)
    sourcemap: isProduction && sentryPluginEnabled ? true : false,
  },
  resolve: {
    alias: {
      '@wine/wine-enrichment': path.resolve(
        __dirname,
        '../../supabase/functions/_shared/wineEnrichment.ts',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  };
});

