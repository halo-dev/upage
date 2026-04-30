import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoaderFunctionArgs } from 'react-router';
import { errorResponse, successResponse } from '~/.server/utils/api-response';

export type DesignSystemItem = {
  brand: string;
  file: string;
  description: string;
  sourceUpdatedAt: string;
};

export const loader = async (_: LoaderFunctionArgs) => {
  try {
    const manifestPath = join(process.cwd(), 'node_modules/getdesign/templates/manifest.json');
    if (!existsSync(manifestPath)) {
      return errorResponse(500, '设计系统清单不存在');
    }

    const manifest: DesignSystemItem[] = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    return successResponse(manifest);
  } catch {
    return errorResponse(500, '读取设计系统清单失败');
  }
};
