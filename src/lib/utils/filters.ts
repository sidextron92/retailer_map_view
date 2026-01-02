import type { Retailer } from '@/types/retailer';
import type { FilterState } from '@/types/filter';

/**
 * Apply all filters to the retailers list
 */
export function applyFilters(
  retailers: Retailer[],
  filters: FilterState
): Retailer[] {
  return retailers.filter((retailer) => {
    // Retailer status filter (replaces category filter) - case insensitive
    if (filters.selectedCategories.length > 0) {
      if (!retailer.retailer_status) {
        return false;
      }
      const statusLower = retailer.retailer_status.toLowerCase();
      const hasMatch = filters.selectedCategories.some(
        (cat) => cat.toLowerCase() === statusLower
      );
      if (!hasMatch) {
        return false;
      }
    }

    // Active/inactive filter (for soft delete)
    if (!filters.showActive && retailer.is_active) return false;
    if (!filters.showInactive && !retailer.is_active) return false;

    // Last visit date filter
    if (filters.lastVisitFrom && retailer.last_visit_date) {
      if (new Date(retailer.last_visit_date) < filters.lastVisitFrom) {
        return false;
      }
    }
    if (filters.lastVisitTo && retailer.last_visit_date) {
      if (new Date(retailer.last_visit_date) > filters.lastVisitTo) {
        return false;
      }
    }

    // Next scheduled visit filter
    if (filters.nextVisitFrom && retailer.next_scheduled_visit) {
      if (new Date(retailer.next_scheduled_visit) < filters.nextVisitFrom) {
        return false;
      }
    }
    if (filters.nextVisitTo && retailer.next_scheduled_visit) {
      if (new Date(retailer.next_scheduled_visit) > filters.nextVisitTo) {
        return false;
      }
    }

    // Search filter (name, address, trader name, state, city, buying category, teamlead, darkstore)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchable = `${retailer.name} ${retailer.address} ${retailer.trader_name || ''} ${retailer.state || ''} ${retailer.city || ''} ${retailer.buying_category || ''} ${retailer.teamlead_name || ''} ${retailer.darkstore || ''}`.toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    // URL-based filters (case insensitive)
    if (filters.darkstoreFilter &&
        retailer.darkstore?.toLowerCase() !== filters.darkstoreFilter.toLowerCase()) {
      return false;
    }

    if (filters.skIdFilter &&
        retailer.sk_id?.toLowerCase() !== filters.skIdFilter.toLowerCase()) {
      return false;
    }

    if (filters.buyingCategoryFilter &&
        retailer.buying_category?.toLowerCase() !== filters.buyingCategoryFilter.toLowerCase()) {
      return false;
    }

    return true;
  });
}

/**
 * Get count of active filters
 */
export function getActiveFilterCount(filters: FilterState): number {
  let count = 0;

  if (filters.selectedCategories.length > 0) count++;
  if (!filters.showActive || !filters.showInactive) count++;
  if (filters.lastVisitFrom || filters.lastVisitTo) count++;
  if (filters.nextVisitFrom || filters.nextVisitTo) count++;
  if (filters.searchQuery) count++;
  if (filters.darkstoreFilter) count++;
  if (filters.skIdFilter) count++;
  if (filters.buyingCategoryFilter) count++;

  return count;
}
