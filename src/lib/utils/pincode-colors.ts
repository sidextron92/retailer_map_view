/**
 * Generate a deterministic color for a pincode based on its value
 * Uses hash function to create varied, visually distinct colors
 */
export function getPincodeColor(pincode: string): string {
  // Hash the pincode to get a number
  let hash = 0;
  for (let i = 0; i < pincode.length; i++) {
    hash = pincode.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate HSL color for better visual distinction
  // Using HSL allows us to control saturation and lightness for consistency
  const hue = Math.abs(hash % 360); // 0-360 degrees
  const saturation = 60 + (Math.abs(hash >> 8) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate outline color (darker version of fill)
 */
export function getPincodeOutlineColor(pincode: string): string {
  let hash = 0;
  for (let i = 0; i < pincode.length; i++) {
    hash = pincode.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85% (slightly more saturated)
  const lightness = 30 + (Math.abs(hash >> 16) % 15); // 30-45% (darker)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Predefined color palette for pincodes (alternative approach)
 * Cycles through colors to ensure adjacent pincodes have different colors
 */
export const PINCODE_COLOR_PALETTE = [
  { fill: '#FFB3BA', outline: '#FF6B7A' },  // Soft red
  { fill: '#BAFFC9', outline: '#6BFF8A' },  // Soft green
  { fill: '#BAE1FF', outline: '#6BB8FF' },  // Soft blue
  { fill: '#FFFFBA', outline: '#FFFF6B' },  // Soft yellow
  { fill: '#FFD9BA', outline: '#FFA76B' },  // Soft orange
  { fill: '#E0BBE4', outline: '#C77FCC' },  // Soft purple
  { fill: '#BFFCC6', outline: '#7FFCA0' },  // Mint
  { fill: '#FFC9DE', outline: '#FF8BC0' },  // Soft pink
  { fill: '#C9E4DE', outline: '#8BCDC0' },  // Soft teal
  { fill: '#D5AAFF', outline: '#A66BFF' },  // Soft lavender
];

/**
 * Get color from palette based on pincode
 */
export function getPincodeColorFromPalette(pincode: string): { fill: string; outline: string } {
  let hash = 0;
  for (let i = 0; i < pincode.length; i++) {
    hash = pincode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PINCODE_COLOR_PALETTE.length;
  return PINCODE_COLOR_PALETTE[index];
}
