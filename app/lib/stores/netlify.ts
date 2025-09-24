import { atom } from 'nanostores';
import { toast } from 'sonner';
import type { NetlifyConnection } from '~/types/netlify';
import { logStore } from './logs';

// Initialize with stored connection or environment variable
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('netlify_connection') : null;

// If we have an environment token but no stored connection, initialize with the env token
const initialConnection: NetlifyConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      isConnect: false,
      stats: undefined,
    };

export const netlifyConnection = atom<NetlifyConnection>(initialConnection);
export const isConnecting = atom<boolean>(initialConnection.isConnect);
export const isFetchingStats = atom<boolean>(false);

export const updateNetlifyConnection = (updates: Partial<NetlifyConnection>) => {
  const currentState = netlifyConnection.get();
  const newState = { ...currentState, ...updates };
  netlifyConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('netlify_connection', JSON.stringify(newState));
  }
};

export async function fetchNetlifyStats() {
  try {
    isFetchingStats.set(true);

    const response = await fetch('/api/netlify/stats');

    if (!response.ok) {
      throw new Error(`获取统计信息失败: ${response.status}`);
    }

    const { data, success, message } = await response.json();

    if (!success) {
      throw new Error(message || '获取统计信息失败');
    }

    const currentState = netlifyConnection.get();
    updateNetlifyConnection({
      ...currentState,
      stats: data,
    });

    toast.success('Netlify 统计信息更新成功');
    return data;
  } catch (error) {
    console.error('Netlify API Error:', error);
    logStore.logError('Failed to fetch Netlify stats', { error });
    toast.error(`获取 Netlify 统计信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw error;
  } finally {
    isFetchingStats.set(false);
  }
}
