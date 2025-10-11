import { DEFAULT_TAB_CONFIG } from '~/.client/components/@settings/core/constants';
import type { TabType, TabVisibilityConfig } from '~/.client/components/@settings/core/types';

export const getVisibleTabs = (
  tabConfiguration: { userTabs: TabVisibilityConfig[]; developerTabs?: TabVisibilityConfig[] },
  isDeveloperMode: boolean,
  notificationsEnabled: boolean,
): TabVisibilityConfig[] => {
  if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
    console.warn('Invalid tab configuration, using defaults');
    return DEFAULT_TAB_CONFIG as TabVisibilityConfig[];
  }

  // In developer mode, show ALL tabs without restrictions
  if (isDeveloperMode) {
    // Combine all unique tabs from both user and developer configurations
    const allTabs = new Set([
      ...DEFAULT_TAB_CONFIG.map((tab) => tab.id),
      ...tabConfiguration.userTabs.map((tab) => tab.id),
      ...(tabConfiguration.developerTabs || []).map((tab) => tab.id),
      'task-manager' as TabType, // Always include task-manager in developer mode
    ]);

    // Create a complete tab list with all tabs visible
    const devTabs = Array.from(allTabs).map((tabId) => {
      // Try to find existing configuration for this tab
      const existingTab =
        tabConfiguration.developerTabs?.find((t) => t.id === tabId) ||
        tabConfiguration.userTabs?.find((t) => t.id === tabId) ||
        DEFAULT_TAB_CONFIG.find((t) => t.id === tabId);

      return {
        id: tabId as TabType,
        visible: true,
        window: 'developer' as const,
        order: existingTab?.order || DEFAULT_TAB_CONFIG.findIndex((t) => t.id === tabId),
      } as TabVisibilityConfig;
    });

    return devTabs.sort((a, b) => a.order - b.order);
  }

  // In user mode, only show visible user tabs
  return tabConfiguration.userTabs
    .filter((tab) => {
      if (!tab || typeof tab.id !== 'string') {
        console.warn('Invalid tab entry:', tab);
        return false;
      }

      // Hide notifications tab if notifications are disabled
      if (tab.id === 'notifications' && !notificationsEnabled) {
        return false;
      }

      // Always show task-manager in user mode if it's configured as visible
      if (tab.id === 'task-manager') {
        return tab.visible;
      }

      // Only show tabs that are explicitly visible and assigned to the user window
      return tab.visible && tab.window === 'user';
    })
    .sort((a, b) => a.order - b.order);
};

export const reorderTabs = (
  tabs: TabVisibilityConfig[],
  startIndex: number,
  endIndex: number,
): TabVisibilityConfig[] => {
  const result = Array.from(tabs);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  // Update order property
  return result.map((tab, index) => ({
    ...tab,
    order: index,
  }));
};

export const resetToDefaultConfig = (isDeveloperMode: boolean): TabVisibilityConfig[] => {
  return DEFAULT_TAB_CONFIG.map((tab) => ({
    ...tab,
    visible: isDeveloperMode ? true : tab.window === 'user',
    window: isDeveloperMode ? 'developer' : tab.window,
  })) as TabVisibilityConfig[];
};
