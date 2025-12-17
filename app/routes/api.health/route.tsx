import { type LoaderFunctionArgs } from '@remix-run/node';
import { successResponse } from '~/.server/utils/api-response';

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};
