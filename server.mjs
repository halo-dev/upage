import { createRequestHandler } from '@remix-run/express';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';

const viteDevServer =
  process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule('virtual:remix/server-build')
    : await import('./build/server/index.js'),
});

const app = express();

app.use(
  cors({
    // 允许所有来源访问，生产环境中应该设置为特定的域名
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  }),
);

// 配置全局限流中间件
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  limit: 100, // 每个 IP 每分钟最多 100 个请求
  standardHeaders: 'draft-7', // 返回标准的 RateLimit 头信息
  legacyHeaders: false, // 禁用旧的 X-RateLimit 头信息
  message: '请求过于频繁，请稍后再试',
});

// 针对聊天 API 的特殊限流中间件
const chatApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2, // 每个 IP 每分钟最多 2 个聊天请求
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: '聊天请求过于频繁，请稍后再试',
  // 仅对聊天 API 路由应用此限制
  skip: (req) => !req.url.includes('/api/chat'),
});

app.use((req, res, next) => {
  if (req.url.startsWith('/assets') || req.url.startsWith('/build') || req.url.includes('.')) {
    return next();
  }

  next();
});

app.use(compression());

app.use(globalLimiter);

app.use('/api/chat', chatApiLimiter);

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable('x-powered-by');

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static('build/client', { maxAge: '1h' }));

// 添加对上传文件的静态服务支持
const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'public', 'uploads');
app.use('/uploads', express.static(storageDir, { maxAge: '1y' }));

app.use(morgan('tiny'));

// handle SSR requests
app.use(remixHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});
