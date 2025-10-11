import type { TabType } from './types';

export const TAB_ICONS: Record<TabType, string> = {
  profile: 'i-ph:user-circle-fill',
  settings: 'i-ph:gear-six-fill',
  notifications: 'i-ph:bell-fill',
  debug: 'i-ph:bug-fill',
  'event-logs': 'i-ph:list-bullets-fill',
  'task-manager': 'i-ph:chart-line-fill',
  'tab-management': 'i-ph:squares-four-fill',
};

export const TAB_LABELS: Record<TabType, string> = {
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
  debug: 'Debug',
  'event-logs': 'Event Logs',
  'task-manager': 'Task Manager',
  'tab-management': 'Tab Management',
};

export const TAB_DESCRIPTIONS: Record<TabType, string> = {
  profile: 'Manage your profile and account settings',
  settings: 'Configure application preferences',
  notifications: 'View and manage your notifications',
  debug: 'Debug tools and system information',
  'event-logs': 'View system events and logs',
  'task-manager': 'Monitor system resources and processes',
  'tab-management': 'Configure visible tabs and their order',
};

export const DEFAULT_TAB_CONFIG = [
  { id: 'notifications', visible: true, window: 'user' as const, order: 5 },
  { id: 'event-logs', visible: true, window: 'user' as const, order: 6 },

  { id: 'settings', visible: false, window: 'user' as const, order: 8 },
  { id: 'task-manager', visible: false, window: 'user' as const, order: 9 },

  // User Window Tabs (Hidden, controlled by TaskManagerTab)
  { id: 'debug', visible: false, window: 'user' as const, order: 11 },

  // Developer Window Tabs (All visible by default)
  { id: 'notifications', visible: true, window: 'developer' as const, order: 5 },
  { id: 'event-logs', visible: true, window: 'developer' as const, order: 6 },
  { id: 'settings', visible: true, window: 'developer' as const, order: 8 },
  { id: 'task-manager', visible: true, window: 'developer' as const, order: 9 },
  { id: 'debug', visible: true, window: 'developer' as const, order: 11 },
];
