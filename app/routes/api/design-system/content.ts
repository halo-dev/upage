import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const brand = url.searchParams.get('brand');

  if (!brand || !/^[\w.-]+$/.test(brand)) {
    return new Response(JSON.stringify({ error: '无效的 brand 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filePath = join(process.cwd(), 'node_modules/getdesign/templates', `${brand}.md`);

  if (!existsSync(filePath)) {
    return new Response(JSON.stringify({ error: `未找到 ${brand} 的设计系统` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '读取设计系统内容失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
