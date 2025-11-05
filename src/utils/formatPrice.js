/**
 * Format price with Indian number system (commas)
 * e.g., 123456 -> 1,23,456
 */
export function formatPrice(price) {
  if (price === null || price === undefined || price === '' || isNaN(price)) {
    return 'N/A';
  }
  
  const num = parseFloat(price);
  if (isNaN(num)) return 'N/A';
  
  // Round to remove decimals
  const rounded = Math.round(num);
  
  // Convert to Indian number system (lakhs, thousands)
  return rounded.toLocaleString('en-IN');
}

/**
 * Format price range
 * e.g., "Min: ₹1,234 - Max: ₹5,678"
 */
export function formatPriceRange(min, max, includeRupee = true) {
  const prefix = includeRupee ? '₹' : '';
  const minFormatted = formatPrice(min);
  const maxFormatted = formatPrice(max);
  
  if (minFormatted === 'N/A' || maxFormatted === 'N/A') {
    return 'N/A';
  }
  
  return `${prefix}${minFormatted} - ${prefix}${maxFormatted}`;
}
