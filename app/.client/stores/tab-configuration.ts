import { atom, map } from 'nanostores';

export interface TabConfig {
  id: string;
  visible: boolean;
  window: 'developer' | 'user';
  order: number;
  locked?: boolean;
}

const DEFAULT_CONFIG = {
  userTabs: [],
  developerTabs: [],
};

export const userTabsStore = atom<TabConfig[]>(DEFAULT_CONFIG.userTabs);
export const developerTabsStore = atom<TabConfig[]>(DEFAULT_CONFIG.developerTabs);

export const tabConfiguration = map({
  userTabs: DEFAULT_CONFIG.userTabs,
  developerTabs: DEFAULT_CONFIG.developerTabs,
});

tabConfiguration.set({
  userTabs: DEFAULT_CONFIG.userTabs,
  developerTabs: DEFAULT_CONFIG.developerTabs,
});

userTabsStore.listen((userTabs) => {
  tabConfiguration.setKey('userTabs', userTabs as never[]);
});

developerTabsStore.listen((developerTabs) => {
  tabConfiguration.setKey('developerTabs', developerTabs as never[]);
});

export const tabConfigurationStore = {
  get: () => ({
    userTabs: userTabsStore.get(),
    developerTabs: developerTabsStore.get(),
  }),

  set: (config: { userTabs: TabConfig[]; developerTabs: TabConfig[] }) => {
    userTabsStore.set(config.userTabs);
    developerTabsStore.set(config.developerTabs);
  },

  reset: () => {
    userTabsStore.set(DEFAULT_CONFIG.userTabs);
    developerTabsStore.set(DEFAULT_CONFIG.developerTabs);
  },
};
