/**
 * Format delivery TAT from seconds to human-readable format
 *
 * @param seconds - Delivery TAT in seconds (null means not serviceable)
 * @returns Formatted string (e.g., "2 Hours", "3 Days", "Not Serviceable")
 */
export function formatDeliveryTAT(seconds: number | null | undefined): string {
  // Handle null or undefined - not serviceable
  if (seconds === null || seconds === undefined) {
    return 'Not Serviceable';
  }

  // Convert seconds to hours
  const hours = seconds / 3600;

  // If less than 24 hours, show in hours
  if (hours < 24) {
    const roundedHours = Math.round(hours);
    return `${roundedHours} ${roundedHours === 1 ? 'Hour' : 'Hours'}`;
  }

  // If 24 hours or more, show in days
  const days = hours / 24;
  const roundedDays = Math.round(days);
  return `${roundedDays} ${roundedDays === 1 ? 'Day' : 'Days'}`;
}
