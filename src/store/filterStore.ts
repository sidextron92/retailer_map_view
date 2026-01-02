import { create } from 'zustand';
import type { FilterStore } from '@/types/filter';

const initialState = {
  selectedCategories: [],
  showActive: true,
  showInactive: true,
  lastVisitFrom: null,
  lastVisitTo: null,
  nextVisitFrom: null,
  nextVisitTo: null,
  searchQuery: '',
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...initialState,

  setCategories: (categories) =>
    set({ selectedCategories: categories }),

  toggleCategory: (category) =>
    set((state) => ({
      selectedCategories: state.selectedCategories.includes(category)
        ? state.selectedCategories.filter((c) => c !== category)
        : [...state.selectedCategories, category],
    })),

  setShowActive: (show) => set({ showActive: show }),

  setShowInactive: (show) => set({ showInactive: show }),

  setLastVisitRange: (from, to) =>
    set({ lastVisitFrom: from, lastVisitTo: to }),

  setNextVisitRange: (from, to) =>
    set({ nextVisitFrom: from, nextVisitTo: to }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  resetFilters: () => set(initialState),
}));
