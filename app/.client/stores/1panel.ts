import { atom } from 'nanostores';
import { toast } from 'sonner';
import type { _1PanelStats } from '~/types/1panel';

export interface _1PanelUser {
  projectName?: string;
  serverUrl?: string;
}

interface _1PanelConnectionState {
  isConnect: boolean;
  stats?: _1PanelStats;
  serverUrl?: string;
}

const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('1panel_connection') : null;
const initialConnection: _1PanelConnectionState = storedConnection
  ? JSON.parse(storedConnection)
  : {
      isConnect: false,
      serverUrl: '',
    };

export const _1PanelConnectionStore = atom<_1PanelConnectionState>(initialConnection);

export const isConnecting = atom<boolean>(initialConnection.isConnect);
export const isFetchingStats = atom<boolean>(false);

export const update1PanelConnection = (updates: Partial<_1PanelConnectionState>) => {
  if (updates.serverUrl) {
    updates.serverUrl = updates.serverUrl.replace(/\/$/, '');
  }
  const currentState = _1PanelConnectionStore.get();
  const newState = { ...currentState, ...updates };
  _1PanelConnectionStore.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('1panel_connection', JSON.stringify(newState));
  }
};

export function reset1PanelConfig() {
  update1PanelConnection({ isConnect: false, serverUrl: '' });
}

export async function fetch1PanelStats() {
  try {
    isFetchingStats.set(true);

    const response = await fetch('/api/1panel/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { data, success, message } = await response.json();

    if (!response.ok || !success) {
      throw new Error(`获取站点数据失败: ${message || response.status}`);
    }

    const websites = data.websites ?? [];
    const currentState = _1PanelConnectionStore.get();

    update1PanelConnection({
      ...currentState,
      isConnect: true,
      stats: data,
    });

    return websites;
  } catch (error) {
    console.error('1Panel API Error:', error);
    toast.error(`获取 1Panel 站点信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    isFetchingStats.set(false);
  }
}
