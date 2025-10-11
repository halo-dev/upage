import Cookies from 'js-cookie';
import { atom, map } from 'nanostores';
import { DEFAULT_TAB_CONFIG } from '~/.client/components/@settings/core/constants';
import type {
  DevTabConfig,
  TabVisibilityConfig,
  TabWindowConfig,
  UserTabConfig,
} from '~/.client/components/@settings/core/types';
import { toggleTheme } from '~/stores/theme';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
  description?: string; // Description of what the shortcut does
  isPreventDefault?: boolean; // Whether to prevent default browser behavior
}

export interface Shortcuts {
  toggleTheme: Shortcut;
}

// Simplified shortcuts store with only theme toggle
export const shortcutsStore = map<Shortcuts>({
  toggleTheme: {
    key: 'd',
    metaKey: true,
    altKey: true,
    shiftKey: true,
    action: () => toggleTheme(),
    description: 'Toggle theme',
    isPreventDefault: true,
  },
});

// Add this helper function at the top of the file
const isBrowser = typeof window !== 'undefined';

export const isDebugMode = atom(false);

export const isProduction = atom(
  isBrowser ? window.ENV.OPERATING_ENV === 'production' : process.env.OPERATING_ENV === 'production',
);
export const isDevelopment = atom(
  isBrowser ? window.ENV.OPERATING_ENV === 'development' : process.env.OPERATING_ENV === 'development',
);
export const isTest = atom(isBrowser ? window.ENV.OPERATING_ENV === 'test' : process.env.OPERATING_ENV === 'test');

// Define keys for localStorage
const SETTINGS_KEYS = {
  LATEST_BRANCH: 'isLatestBranch',
  EVENT_LOGS: 'isEventLogsEnabled',
  PROMPT_ID: 'promptId',
  DEVELOPER_MODE: 'isDeveloperMode',
} as const;

// Initialize settings from localStorage or defaults
const getInitialSettings = () => {
  const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
    if (!isBrowser) {
      return defaultValue;
    }

    const stored = localStorage.getItem(key);

    if (stored === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return defaultValue;
    }
  };

  return {
    latestBranch: getStoredBoolean(SETTINGS_KEYS.LATEST_BRANCH, false),
    eventLogs: getStoredBoolean(SETTINGS_KEYS.EVENT_LOGS, true),
    promptId: isBrowser ? localStorage.getItem(SETTINGS_KEYS.PROMPT_ID) || 'default' : 'default',
    developerMode: getStoredBoolean(SETTINGS_KEYS.DEVELOPER_MODE, false),
  };
};

// Initialize stores with persisted values
const initialSettings = getInitialSettings();

export const latestBranchStore = atom<boolean>(initialSettings.latestBranch);
export const isEventLogsEnabled = atom<boolean>(initialSettings.eventLogs);
export const promptStore = atom<string>(initialSettings.promptId);

// Helper functions to update settings with persistence
export const updateLatestBranch = (enabled: boolean) => {
  latestBranchStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.LATEST_BRANCH, JSON.stringify(enabled));
};

export const updateEventLogs = (enabled: boolean) => {
  isEventLogsEnabled.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.EVENT_LOGS, JSON.stringify(enabled));
};

export const updatePromptId = (id: string) => {
  promptStore.set(id);
  localStorage.setItem(SETTINGS_KEYS.PROMPT_ID, id);
};

// Initialize tab configuration from localStorage or defaults
const getInitialTabConfiguration = (): TabWindowConfig => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };

  if (!isBrowser) {
    return defaultConfig;
  }

  try {
    const saved = localStorage.getItem('upage_tab_configuration');

    if (!saved) {
      return defaultConfig;
    }

    const parsed = JSON.parse(saved);

    if (!parsed?.userTabs || !parsed?.developerTabs) {
      return defaultConfig;
    }

    // Ensure proper typing of loaded configuration
    return {
      userTabs: parsed.userTabs.filter((tab: TabVisibilityConfig): tab is UserTabConfig => tab.window === 'user'),
      developerTabs: parsed.developerTabs.filter(
        (tab: TabVisibilityConfig): tab is DevTabConfig => tab.window === 'developer',
      ),
    };
  } catch (error) {
    console.warn('Failed to parse tab configuration:', error);
    return defaultConfig;
  }
};

export const tabConfigurationStore = map<TabWindowConfig>(getInitialTabConfiguration());

// Helper function to update tab configuration
export const updateTabConfiguration = (config: TabVisibilityConfig) => {
  const currentConfig = tabConfigurationStore.get();
  console.log('Current tab configuration before update:', currentConfig);

  const isUserTab = config.window === 'user';
  const targetArray = isUserTab ? 'userTabs' : 'developerTabs';

  // Only update the tab in its respective window
  const updatedTabs = currentConfig[targetArray].map((tab) => (tab.id === config.id ? { ...config } : tab));

  // If tab doesn't exist in this window yet, add it
  if (!updatedTabs.find((tab) => tab.id === config.id)) {
    updatedTabs.push(config);
  }

  // Create new config, only updating the target window's tabs
  const newConfig: TabWindowConfig = {
    ...currentConfig,
    [targetArray]: updatedTabs,
  };

  console.log('New tab configuration after update:', newConfig);

  tabConfigurationStore.set(newConfig);
  Cookies.set('tabConfiguration', JSON.stringify(newConfig), {
    expires: 365, // Set cookie to expire in 1 year
    path: '/',
    sameSite: 'strict',
  });
};

// Helper function to reset tab configuration
export const resetTabConfiguration = () => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };

  tabConfigurationStore.set(defaultConfig);
  localStorage.setItem('upage_tab_configuration', JSON.stringify(defaultConfig));
};

// Settings panel state
export const settingsStore = map({
  isOpen: false,
  selectedTab: 'user', // Default tab
});

// Settings panel actions
export const openSettings = () => {
  settingsStore.setKey('isOpen', true);
  settingsStore.setKey('selectedTab', 'user'); // Always open to user tab
};

export const closeSettings = () => {
  settingsStore.setKey('isOpen', false);
  settingsStore.setKey('selectedTab', 'user'); // Reset to user tab when closing
};

export const setSelectedTab = (tab: string) => {
  settingsStore.setKey('selectedTab', tab);
};
