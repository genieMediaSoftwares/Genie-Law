import { create } from 'zustand';

interface UiState {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  isCreateSheetOpen: boolean;
  openCreateSheet: () => void;
  closeCreateSheet: () => void;
}

export const useUiStore = create<UiState>(set => ({
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true, isCreateSheetOpen: false }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  isCreateSheetOpen: false,
  openCreateSheet: () => set({ isCreateSheetOpen: true, isDrawerOpen: false }),
  closeCreateSheet: () => set({ isCreateSheetOpen: false }),
}));
