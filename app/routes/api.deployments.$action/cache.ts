interface CacheItem {
  data: any;
  expiry: number;
}

const cache: Record<string, CacheItem> = {};

// 1 分钟缓存时间
const CACHE_TTL = 1 * 60 * 1000;

export function getFromCache(key: string): any | null {
  const item = cache[key];
  if (!item) {
    return null;
  }

  if (Date.now() > item.expiry) {
    delete cache[key];
    return null;
  }

  return item.data;
}

export function setCache(key: string, data: any): void {
  cache[key] = {
    data,
    expiry: Date.now() + CACHE_TTL,
  };
}

export function clearCache(key: string): void {
  delete cache[key];
}

setInterval(
  () => {
    const now = Date.now();
    for (const key in cache) {
      if (cache[key].expiry < now) {
        delete cache[key];
      }
    }
  },
  60 * 60 * 1000,
);
