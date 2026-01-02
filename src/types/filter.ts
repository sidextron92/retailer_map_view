export interface FilterState {
  // Retailer status filters (replaces category - links to retailer_categories)
  selectedCategories: string[];

  // Active/inactive filters (for soft delete)
  showActive: boolean;
  showInactive: boolean;

  // Date filters
  lastVisitFrom: Date | null;
  lastVisitTo: Date | null;
  nextVisitFrom: Date | null;
  nextVisitTo: Date | null;

  // Search filter
  searchQuery: string;

  // URL-based filters
  darkstoreFilter: string | null;
  skIdFilter: string | null;
  buyingCategoryFilter: string | null;
}

export interface FilterActions {
  setCategories: (categories: string[]) => void;
  toggleCategory: (category: string) => void;
  setShowActive: (show: boolean) => void;
  setShowInactive: (show: boolean) => void;
  setLastVisitRange: (from: Date | null, to: Date | null) => void;
  setNextVisitRange: (from: Date | null, to: Date | null) => void;
  setSearchQuery: (query: string) => void;
  setDarkstoreFilter: (darkstore: string | null) => void;
  setSkIdFilter: (skId: string | null) => void;
  setBuyingCategoryFilter: (category: string | null) => void;
  setUrlFilters: (params: { darkstore?: string | null; skId?: string | null; buyingCategory?: string | null }) => void;
  resetFilters: () => void;
}

export type FilterStore = FilterState & FilterActions;
