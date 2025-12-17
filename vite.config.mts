import { reactRouter } from '@react-router/dev/vite';
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
      reactRouter(),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      excludeUploadsPlugin(),
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

function excludeUploadsPlugin() {
  return {
    name: 'exclude-uploads',
    apply: 'build' as const,
    enforce: 'post' as const,
    async closeBundle() {
      const fs = await import('fs');
      const path = await import('path');
      const uploadsPath = path.resolve(process.cwd(), 'build/client/uploads');

      if (fs.existsSync(uploadsPath)) {
        try {
          fs.rmSync(uploadsPath, { recursive: true, force: true });
          console.log('✓ 已从构建产物中排除 uploads 目录');
        } catch (error) {
          console.warn('⚠ 删除 uploads 目录时出错:', error);
        }
      }
    },
  };
}
