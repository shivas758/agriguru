/**
 * Commodity Image Service
 * Handles mapping of commodity names to their image paths
 */

class CommodityImageService {
  constructor() {
    // Base path for commodity images
    this.basePath = '/commodities/';
    
    // Supported image formats
    this.imageFormats = ['jpg', 'png', 'webp', 'jpeg'];
    
    // Cache for loaded images
    this.imageCache = new Map();
  }

  /**
   * Normalize commodity name to match image filename
   * Example: "Castor Seed" -> "castor-seed"
   * Also handles serial numbers: "1.cotton", "2.paddy", etc.
   */
  normalizeCommodityName(commodityName) {
    if (!commodityName) return null;
    
    return commodityName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '')     // Remove special characters except hyphens
      .replace(/-+/g, '-')            // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
  }

  /**
   * Get all possible image path variations for a commodity
   * Tries: exact match, with serial numbers (1-20 for common commodities)
   */
  getImagePathVariations(normalizedName) {
    const variations = [];
    
    // Try exact match first
    variations.push(normalizedName);
    
    // Try with serial numbers (1-20 is enough for most cases)
    for (let i = 1; i <= 20; i++) {
      variations.push(`${i}.${normalizedName}`);
    }
    
    return variations;
  }

  /**
   * Get image path for a commodity
   * Returns the path if image exists, otherwise returns null
   * Supports partial matching: "Castor Seed" will match "Castor.jpg"
   * Tries multiple strategies for best match
   */
  getCommodityImagePath(commodityName) {
    if (!commodityName) return null;

    // Check cache first
    const normalizedName = this.normalizeCommodityName(commodityName);
    if (this.imageCache.has(normalizedName)) {
      return this.imageCache.get(normalizedName);
    }

    // List of available images (based on your commodities folder)
    // Note: These match the actual filenames including spaces
    const availableImages = [
      'Ajwain', 'Allspice', 'Amaranthus', 'Amla', 'Apple', 'Arecanut', 'Ash Gourd',
      'Banana', 'Banyardmillet', 'Beetroot', 'Bengalgram', 'Ber', 'Bittergourd',
      'Black Pepper', 'Blackgram', 'Bottlegourd', 'Brinjal', 'Broadbeans', 'BrowntopMillet',
      'Cabbage', 'Capsicum', 'Cardomom', 'Carrot', 'Cashewnut', 'Castor', 'Cauliflower',
      'Chilli', 'ChowChow', 'Chrysanthemum', 'Cinnamom', 'Clove', 'Clusterbean', 'Cocoa',
      'Coconut', 'Coffee', 'Commonmillet', 'Coriander', 'Cotton', 'Cowpea', 'Crossandra',
      'Cucumber', 'CurryLeaf', 'DrumStick', 'Fennel', 'Fenugreek', 'Fieldbean', 'Fieldbeans',
      'Fingermillet', 'Foxtailmillet', 'Garlic', 'Gherkin', 'Gingelly', 'Ginger', 'Grapes',
      'Greengram', 'Groundnut', 'Guava', 'Horsegram', 'Jake', 'Jamun', 'Jasmine', 'Jowar',
      'Jute', 'Kodomillet', 'Ladiesfinger', 'Lemon', 'Littlemillet', 'Maize', 'MandarinOrange',
      'Mango', 'Marigold', 'Muskmelon', 'Mustard', 'Nutmeg', 'Oilpalm', 'Onion', 'Paddy',
      'Palmyrah', 'Peach', 'Pear', 'PearlMillet', 'Peas', 'Pineapple', 'Piper betle', 'Plum',
      'Pomegranate', 'Potato', 'Pumpkin', 'Radish', 'Redgram', 'Ridgegourd', 'Rose', 'Rubber',
      'Safflower', 'Sapoto', 'Snakegourd', 'Soybean', 'Sugarcane', 'Sunflower', 'Sweat Orange',
      'SweatPotato', 'Swordbean', 'Tamarind', 'Tea', 'Tomato', 'Turmeric', 'Watermelon',
      'Wheat', 'papaya'
    ];

    // Normalize commodity name for comparison
    const commodityLower = commodityName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Strategy 1: Try exact match with title case
    const titleCaseName = commodityName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('-')
      .replace(/[^a-zA-Z0-9-]/g, '');
    
    // Check if exact match exists in available images
    const exactMatch = availableImages.find(img => 
      img.toLowerCase().replace(/[^a-z0-9]/g, '') === commodityLower
    );
    
    if (exactMatch) {
      return `${this.basePath}${exactMatch}.jpg`;
    }

    // Strategy 2: Try partial match - find if any image name is contained in commodity name
    // or if commodity name is contained in image name
    const partialMatch = availableImages.find(img => {
      const imgLower = img.toLowerCase().replace(/[^a-z0-9]/g, '');
      // "Castor" image matches "CastorSeed" commodity
      return commodityLower.includes(imgLower) || imgLower.includes(commodityLower);
    });

    if (partialMatch) {
      return `${this.basePath}${partialMatch}.jpg`;
    }

    // Strategy 3: Try matching first word only
    const firstWord = commodityName.split(/[\s-]/)[0];
    const firstWordMatch = availableImages.find(img => {
      const imgLower = img.toLowerCase().replace(/[^a-z0-9]/g, '');
      const firstWordLower = firstWord.toLowerCase().replace(/[^a-z0-9]/g, '');
      return imgLower === firstWordLower || imgLower.includes(firstWordLower);
    });

    if (firstWordMatch) {
      return `${this.basePath}${firstWordMatch}.jpg`;
    }

    // Fallback: Return title case path (will show fallback icon if doesn't exist)
    return `${this.basePath}${titleCaseName}.jpg`;
  }

  /**
   * Preload commodity image
   * Returns a promise that resolves when image is loaded
   */
  preloadImage(commodityName) {
    return new Promise((resolve, reject) => {
      const imagePath = this.getCommodityImagePath(commodityName);
      if (!imagePath) {
        reject(new Error('No image path found'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const normalizedName = this.normalizeCommodityName(commodityName);
        this.imageCache.set(normalizedName, imagePath);
        resolve(imagePath);
      };
      img.onerror = () => {
        reject(new Error('Image failed to load'));
      };
      img.src = imagePath;
    });
  }

  /**
   * Check if image exists for a commodity
   */
  async hasImage(commodityName) {
    try {
      await this.preloadImage(commodityName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback icon component name for a commodity
   * Returns the Lucide icon name to use as fallback
   */
  getFallbackIcon(commodityName) {
    // Default fallback icon
    return 'Package';
  }

  /**
   * Batch preload images for multiple commodities
   */
  async preloadMultiple(commodityNames) {
    const promises = commodityNames.map(name => 
      this.preloadImage(name).catch(() => null)
    );
    return Promise.all(promises);
  }

  /**
   * Clear image cache
   */
  clearCache() {
    this.imageCache.clear();
  }
}

export default new CommodityImageService();
