import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { errorResponse } from '~/utils/api-response';
import { appInfoAction, appInfoLoader } from './app-info.server';
import { diskAction, diskLoader } from './disk.server';
import { gitInfoLoader } from './git-info.server';
import { memoryAction, memoryLoader } from './memory.server';
import { processAction, processLoader } from './process.server';

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  if (params.action === 'git-info') {
    return gitInfoLoader(args);
  }

  if (process.env.NODE_ENV !== 'development') {
    return errorResponse(403, '无权限访问');
  }

  switch (params.action) {
    case 'app-info':
      return appInfoLoader(args);
    case 'disk':
      return diskLoader(args);
    case 'memory':
      return memoryLoader(args);
    case 'process':
      return processLoader(args);
    default:
      return errorResponse(404, '未找到API');
  }
}

export async function action(args: ActionFunctionArgs) {
  if (process.env.NODE_ENV !== 'development') {
    return errorResponse(403, '无权限访问');
  }

  const { params } = args;

  switch (params.action) {
    case 'app-info':
      return appInfoAction(args);
    case 'disk':
      return diskAction(args);
    case 'memory':
      return memoryAction(args);
    case 'process':
      return processAction(args);
    case 'git-info':
    default:
      return errorResponse(404, '未找到API');
  }
}
