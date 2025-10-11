// Core exports
export { ControlPanel } from './core/ControlPanel';
// Constants
export { DEFAULT_TAB_CONFIG, TAB_DESCRIPTIONS, TAB_LABELS } from './core/constants';
// Shared components
export { TabTile } from './core/TabTile';
export type { TabType, TabVisibilityConfig } from './core/types';
export * from './utils/animations';
// Utils
export { getVisibleTabs, reorderTabs, resetToDefaultConfig } from './utils/tab-helpers';
