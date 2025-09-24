import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import * as dotenv from 'dotenv';
import UnoCSS from 'unocss/vite';
import { type ViteDevServer, defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

dotenv.config();

export default defineConfig((config) => {
  return {
    server: {
      port: 5173,
      allowedHosts: true
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          format: 'esm',
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      entries: ['./app/entry.client.tsx', './app/root.tsx', './app/routes/*'],
    },
    plugins: [
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true,
          v3_lazyRouteDiscovery: true,
        },
        serverModuleFormat: 'esm',
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end('<body><h1>Please use Chrome Canary for testing.</h1></body>');

            return;
          }
        }

        next();
      });
    },
  };
}
