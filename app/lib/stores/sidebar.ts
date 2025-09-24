import { atom } from 'nanostores';

export const kSidebar = 'upage_sidebar';

export const DEFAULT_SIDEBAR_STATE = false;

export const sidebarStore = atom<boolean>(DEFAULT_SIDEBAR_STATE);

export function toggleSidebar() {
  const currentSidebar = sidebarStore.get();
  const newSidebar = !currentSidebar;

  // Update the theme store
  sidebarStore.set(newSidebar);
}
