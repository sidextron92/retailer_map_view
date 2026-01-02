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
  darkstoreFilter: null,
  skIdFilter: null,
  buyingCategoryFilter: null,
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

  setDarkstoreFilter: (darkstore) => set({ darkstoreFilter: darkstore }),

  setSkIdFilter: (skId) => set({ skIdFilter: skId }),

  setBuyingCategoryFilter: (category) => set({ buyingCategoryFilter: category }),

  setUrlFilters: (params) =>
    set({
      darkstoreFilter: params.darkstore !== undefined ? params.darkstore : null,
      skIdFilter: params.skId !== undefined ? params.skId : null,
      buyingCategoryFilter: params.buyingCategory !== undefined ? params.buyingCategory : null,
    }),

  resetFilters: () => set(initialState),
}));
