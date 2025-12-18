import type { LoaderFunctionArgs } from 'react-router';
import { logto } from '~/.server/service/auth';

export const loader = async (args: LoaderFunctionArgs) => {
  return logto.handleAuthRoutes({
    'sign-in': {
      path: '/api/auth/sign-in',
      redirectBackTo: '/api/auth/callback',
    },
    'sign-in-callback': {
      path: '/api/auth/callback',
      redirectBackTo: '/',
    },
    'sign-out': {
      path: '/api/auth/sign-out',
      redirectBackTo: '/',
    },
    'sign-up': {
      path: '/api/auth/sign-up',
      redirectBackTo: '/api/auth/callback',
    },
  })(args);
};
