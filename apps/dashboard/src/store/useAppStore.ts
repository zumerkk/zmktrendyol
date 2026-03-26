import { create } from "zustand";

interface AppState {
  godModeEnabled: boolean;
  setGodModeEnabled: (enabled: boolean) => void;
  activeSidebarItem: string;
  setActiveSidebarItem: (item: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  godModeEnabled: false,
  setGodModeEnabled: (enabled) => set({ godModeEnabled: enabled }),
  activeSidebarItem: "Dashboard",
  setActiveSidebarItem: (item) => set({ activeSidebarItem: item }),
}));
