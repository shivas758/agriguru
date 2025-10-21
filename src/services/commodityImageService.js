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
   * Supports serial numbers: 1.cotton.jpg, 2.paddy.jpg, etc.
   * Tries both lowercase and title case for compatibility
   */
  getCommodityImagePath(commodityName) {
    if (!commodityName) return null;

    // Check cache first
    const normalizedName = this.normalizeCommodityName(commodityName);
    if (this.imageCache.has(normalizedName)) {
      return this.imageCache.get(normalizedName);
    }

    // Try title case first (matches your file naming: Cabbage.jpg, Potato.jpg)
    // Convert "cabbage" to "Cabbage", "green chilli" to "Green-Chilli"
    const titleCaseName = commodityName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('-')
      .replace(/[^a-zA-Z0-9-]/g, '');
    
    // Return title case path first (most likely to match your files)
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
