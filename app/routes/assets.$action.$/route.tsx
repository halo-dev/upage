import { type LoaderFunctionArgs } from 'react-router';
import { errorResponse } from '~/.server/utils/api-response';
import { assetsUser } from './user.server';

export const USER_DIR = 'users';

export async function loader(loader: LoaderFunctionArgs) {
  const { params } = loader;
  switch (params.action) {
    case USER_DIR:
      return assetsUser(loader);
    default:
      return errorResponse(404, '不支持该操作');
  }
}
