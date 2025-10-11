import { atom } from 'nanostores';
import { toast } from 'sonner';
import { logStore } from '~/stores/logs';
import type { VercelConnection } from '~/types/vercel';

// Initialize with stored connection or defaults
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('vercel_connection') : null;
const initialConnection: VercelConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      isConnect: false,
      user: null,
      stats: undefined,
    };

export const vercelConnection = atom<VercelConnection>(initialConnection);
export const isConnect = atom<boolean>(initialConnection.isConnect);
export const isFetchingStats = atom<boolean>(false);

export const updateVercelConnection = (updates: Partial<VercelConnection>) => {
  const currentState = vercelConnection.get();
  const newState = { ...currentState, ...updates };
  vercelConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('vercel_connection', JSON.stringify(newState));
  }
};

export async function fetchVercelStats() {
  try {
    isFetchingStats.set(true);

    const response = await fetch('/api/vercel/stats');

    if (!response.ok) {
      throw new Error(`获取统计信息失败: ${response.status}`);
    }

    const { data, success, message } = await response.json();

    if (!success) {
      throw new Error(message || '获取统计信息失败');
    }

    const currentState = vercelConnection.get();
    updateVercelConnection({
      ...currentState,
      stats: data,
    });

    toast.success('Vercel 统计信息更新成功');
    return data;
  } catch (error) {
    console.error('Vercel API Error:', error);
    logStore.logError('Failed to fetch Vercel stats', { error });
    toast.error(`获取 Vercel 统计信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw error;
  } finally {
    isFetchingStats.set(false);
  }
}
