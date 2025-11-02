/**
 * Crop Aliases Configuration
 * 
 * Maps common crop name variations to handle ambiguity.
 * When searching for one name, all aliases will be searched.
 * 
 * Example: Searching for "Maize" will also search for "Corn"
 */

export const CROP_ALIASES = {
  // Cereals
  'maize': ['corn', 'makka', 'bhutta'],
  'corn': ['maize', 'makka', 'bhutta'],
  'paddy': ['rice', 'dhan', 'chawal'],
  'rice': ['paddy', 'dhan', 'chawal'],
  'wheat': ['gehun', 'gehu'],
  'bajra': ['pearl millet', 'bajri'],
  'jowar': ['sorghum', 'cholam'],
  'ragi': ['finger millet', 'nachni'],
  
  // Pulses
  'bengal gram': ['chana', 'chickpea', 'gram'],
  'chana': ['bengal gram', 'chickpea', 'gram'],
  'chickpea': ['chana', 'bengal gram', 'gram'],
  'masoor': ['lentil', 'red lentil'],
  'lentil': ['masoor', 'red lentil'],
  'moong': ['green gram', 'mung bean'],
  'green gram': ['moong', 'mung bean'],
  'urad': ['black gram', 'black lentil'],
  'black gram': ['urad', 'black lentil'],
  'tur': ['arhar', 'pigeon pea', 'toor', 'tuar'],
  'arhar': ['tur', 'pigeon pea', 'toor', 'tuar'],
  
  // Vegetables
  'tomato': ['tamatar'],
  'potato': ['aloo', 'batata'],
  'onion': ['pyaz', 'kanda'],
  'brinjal': ['eggplant', 'baingan', 'aubergine'],
  'eggplant': ['brinjal', 'baingan', 'aubergine'],
  'capsicum': ['bell pepper', 'shimla mirch'],
  'bell pepper': ['capsicum', 'shimla mirch'],
  'cauliflower': ['gobi', 'phool gobi'],
  'cabbage': ['patta gobi', 'band gobi'],
  'okra': ['bhindi', 'lady finger', "lady's finger"],
  'lady finger': ['bhindi', 'okra', "lady's finger"],
  
  // Fruits
  'banana': ['kela'],
  'mango': ['aam'],
  'apple': ['seb'],
  'pomegranate': ['anar', 'anaar'],
  'grapes': ['angoor'],
  
  // Spices
  'turmeric': ['haldi'],
  'coriander': ['dhania'],
  'chilli': ['chili', 'mirch', 'red chilli', 'green chilli'],
  'chili': ['chilli', 'mirch', 'red chilli', 'green chilli'],
  'ginger': ['adrak'],
  'garlic': ['lahsun'],
  
  // Oil seeds
  'groundnut': ['peanut', 'moongphali'],
  'peanut': ['groundnut', 'moongphali'],
  'mustard': ['sarson', 'rai'],
  'sunflower': ['surajmukhi'],
  'sesame': ['til', 'gingelly'],
  
  // Cash crops
  'cotton': ['kapas'],
  'sugarcane': ['ganna'],
  'jute': ['pat']
};

/**
 * Get all aliases for a crop name (including the name itself)
 * @param {string} cropName - The crop name to search for
 * @returns {string[]} - Array of all aliases including the original name
 */
export function getCropAliases(cropName) {
  if (!cropName) return [];
  
  const normalized = cropName.toLowerCase().trim();
  
  // Return aliases if found, otherwise return just the original name
  if (CROP_ALIASES[normalized]) {
    return [normalized, ...CROP_ALIASES[normalized]];
  }
  
  return [normalized];
}

/**
 * Check if two crop names are aliases of each other
 * @param {string} crop1 
 * @param {string} crop2 
 * @returns {boolean}
 */
export function areCropAliases(crop1, crop2) {
  if (!crop1 || !crop2) return false;
  
  const normalized1 = crop1.toLowerCase().trim();
  const normalized2 = crop2.toLowerCase().trim();
  
  if (normalized1 === normalized2) return true;
  
  const aliases1 = getCropAliases(normalized1);
  const aliases2 = getCropAliases(normalized2);
  
  // Check if any alias of crop1 matches any alias of crop2
  return aliases1.some(alias => aliases2.includes(alias));
}

export default {
  CROP_ALIASES,
  getCropAliases,
  areCropAliases
};
