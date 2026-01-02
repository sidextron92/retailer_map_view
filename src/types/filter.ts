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

  // Note: URL-based filters (darkstore, sk_id, buying_category) are now handled
  // server-side in useRetailers hook for better performance
}

export interface FilterActions {
  setCategories: (categories: string[]) => void;
  toggleCategory: (category: string) => void;
  setShowActive: (show: boolean) => void;
  setShowInactive: (show: boolean) => void;
  setLastVisitRange: (from: Date | null, to: Date | null) => void;
  setNextVisitRange: (from: Date | null, to: Date | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export type FilterStore = FilterState & FilterActions;
