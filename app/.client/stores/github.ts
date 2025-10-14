import { atom } from 'nanostores';
import type { GitHubConnectionInfo } from '~/types/github';

const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('github_connection') : null;
const initialConnection: GitHubConnectionInfo = storedConnection
  ? JSON.parse(storedConnection)
  : {
      isConnect: false,
      user: null,
      stats: undefined,
    };

export const githubConnection = atom<GitHubConnectionInfo>(initialConnection);
export const isConnect = atom<boolean>(initialConnection.isConnect);

export const updateGitHubConnection = (updates: Partial<GitHubConnectionInfo>) => {
  const currentState = githubConnection.get();
  const newState = { ...currentState, ...updates };
  githubConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('github_connection', JSON.stringify(newState));
  }
};

export const clearGitHubConnection = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('github_connection');
  }
  githubConnection.set({
    isConnect: false,
    user: null,
    stats: undefined,
  });
};
