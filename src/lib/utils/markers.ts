import { differenceInDays } from 'date-fns';
import type { Retailer, RetailerCategory } from '@/types/retailer';

// Retailer status color mapping (will also fetch from database)
const STATUS_COLORS: Record<string, string> = {
  Active: '#2ECC71',
  Idle: '#F39C12',
  Churn: '#E74C3C',
};

/**
 * Get marker color based on priority system:
 * 1. Activity status (soft delete - inactive = gray)
 * 2. Scheduled visit (due soon = orange)
 * 3. Retailer status color (default)
 */
export function getMarkerColor(retailer: Retailer): string {
  // Priority 1: Activity status (soft delete)
  if (!retailer.is_active) {
    return '#95A5A6'; // Gray
  }

  // Priority 2: Upcoming scheduled visit (2 days or less)
  if (retailer.next_scheduled_visit) {
    const daysUntil = differenceInDays(
      new Date(retailer.next_scheduled_visit),
      new Date()
    );
    if (daysUntil <= 2 && daysUntil >= 0) {
      return '#F39C12'; // Orange
    }
  }

  // Default: Retailer status color
  return getStatusColor(retailer.retailer_status || 'Active');
}

/**
 * Get status color from mapping (case-insensitive fallback)
 */
export function getStatusColor(status: string): string {
  // Direct match first
  if (STATUS_COLORS[status]) {
    return STATUS_COLORS[status];
  }

  // Case-insensitive fallback
  const statusLower = status.toLowerCase();
  const matchingKey = Object.keys(STATUS_COLORS).find(
    key => key.toLowerCase() === statusLower
  );

  return matchingKey ? STATUS_COLORS[matchingKey] : STATUS_COLORS.Active;
}

/**
 * Get icon name for marker based on retailer status
 */
export function getMarkerIcon(retailer: Retailer): string {
  const iconMap: Record<string, string> = {
    Active: 'map-pin',
    Idle: 'clock',
    Churn: 'x-circle',
  };

  const status = retailer.retailer_status || 'Active';

  // Direct match first
  if (iconMap[status]) {
    return iconMap[status];
  }

  // Case-insensitive fallback
  const statusLower = status.toLowerCase();
  const matchingKey = Object.keys(iconMap).find(
    key => key.toLowerCase() === statusLower
  );

  return matchingKey ? iconMap[matchingKey] : 'map-pin';
}

/**
 * Update status colors from database (retailer_categories table)
 */
export function updateStatusColors(categories: RetailerCategory[]) {
  categories.forEach((cat) => {
    STATUS_COLORS[cat.name] = cat.color_hex;
  });
}
