/**
 * Service to generate market price images for download
 * Uses HTML5 Canvas API to create clean table-based images
 * Enhanced to match professional market price boards
 */

import commodityImageService from './commodityImageService';
import imageCacheService from './imageCacheService';
import { formatPrice } from '../utils/formatPrice';
import { getTranslation } from '../config/translations';

class MarketImageService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.enableCache = true; // Enable/disable caching
  }

  /**
   * Generate multiple images with market commodity prices (pagination)
   * @param {Array} priceData - Array of price data objects
   * @param {Object} marketInfo - Market information (name, district, state)
   * @param {number} itemsPerPage - Number of items per image (default: 12 for table layout)
   * @param {boolean} isHistorical - Whether this is historical data
   * @returns {Promise<Array>} - Array of Base64 image data URLs
   */
  async generateMarketPriceImages(priceData, marketInfo = {}, itemsPerPage = 12, isHistorical = false, language = 'en') {
    if (!priceData || priceData.length === 0) {
      throw new Error('No price data available to generate image');
    }

    // Split data into pages
    const pages = [];
    for (let i = 0; i < priceData.length; i += itemsPerPage) {
      pages.push(priceData.slice(i, i + itemsPerPage));
    }

    console.log(`Generating ${pages.length} images for ${priceData.length} items`);

    // Check cache first if enabled
    if (this.enableCache) {
      const cachedImages = await this.getCachedImages(marketInfo, pages.length, isHistorical);
      if (cachedImages && cachedImages.length === pages.length) {
        console.log(`✓ Returning ${cachedImages.length} cached images`);
        return cachedImages;
      }
    }

    // Generate each page
    const images = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageData = pages[pageIndex];
      const imageUrl = await this.generateSinglePageImage(
        pageData, 
        marketInfo, 
        pageIndex + 1, 
        pages.length,
        isHistorical,
        language
      );
      images.push(imageUrl);
    }

    // Cache generated images if enabled
    if (this.enableCache) {
      await this.cacheImages(images, marketInfo, pages.length, isHistorical);
    }

    return images;
  }

  /**
   * Generate a single page image with market commodity prices in table format
   * @param {Array} priceData - Array of price data objects for this page
   * @param {Object} marketInfo - Market information (name, district, state)
   * @param {number} pageNumber - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {boolean} isHistorical - Whether this is historical data
   * @returns {Promise<string>} - Base64 image data URL
   */
  async generateSinglePageImage(priceData, marketInfo = {}, pageNumber = 1, totalPages = 1, isHistorical = false, language = 'en') {
    const t = (key) => getTranslation(language, key);
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Table dimensions - Portrait layout for mobile with 2x resolution for sharpness
    const scale = 2; // High resolution multiplier
    const rowHeight = 90 * scale;
    const headerRowHeight = 70 * scale;
    const titleHeight = 110 * scale;
    const footerHeight = 45 * scale;
    const canvasWidth = 600 * scale;  // Portrait width for mobile at 2x resolution
    const canvasHeight = titleHeight + headerRowHeight + (priceData.length * rowHeight) + footerHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Scale context for high resolution
    ctx.scale(scale, scale);

    // Background - white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title section (pass unscaled width)
    await this.drawTitleSection(ctx, marketInfo, canvasWidth, isHistorical, priceData, t);
    
    // Draw table
    const tableY = titleHeight;
    await this.drawTable(ctx, priceData, tableY, canvasWidth, isHistorical, t);

    // Footer (pass unscaled values)
    this.drawFooter(ctx, (canvasHeight - footerHeight) / scale, canvasWidth / scale, canvasHeight / scale, pageNumber, totalPages);

    // Convert canvas to image
    return canvas.toDataURL('image/png');
  }

  /**
   * Draw title section with market name and date
   */
  async drawTitleSection(ctx, marketInfo, canvasWidth, isHistorical = false, priceData = [], t = (key) => key) {
    const padding = 30;
    
    // Draw person image on the left - aligned with table edge
    try {
      const personImg = await this.loadImage('/image/pricephoto.png');
      const imgSize = 100;
      ctx.drawImage(personImg, padding, 10, imgSize, imgSize);
    } catch (error) {
      console.log('Could not load person image:', error);
    }
    
    // Title
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${marketName} ${t('marketPriceBoard')}`, canvasWidth / 2, 40);

    // Current date
    const today = new Date();
    const day = today.getDate();
    const monthNames = [
      t('monthJan'), t('monthFeb'), t('monthMar'), t('monthApr'), t('monthMay'), t('monthJun'),
      t('monthJul'), t('monthAug'), t('monthSep'), t('monthOct'), t('monthNov'), t('monthDec')
    ];
    const month = monthNames[today.getMonth()];
    const year = today.getFullYear();
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${day} ${month} ${year}`, canvasWidth / 2, 70);
    
    // Last updated date - find the most recent date from price data
    let lastUpdatedText = '';
    if (priceData && priceData.length > 0) {
      // Get the most recent date from the data
      const dates = priceData.map(item => {
        if (!item.arrivalDate) return null;
        const parts = item.arrivalDate.split(/[-/]/);
        if (parts.length === 3) {
          // Detect format: if first part is 4 digits, it's YYYY-MM-DD, else DD-MM-YYYY
          if (parts[0].length === 4) {
            // YYYY-MM-DD format (from database)
            return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
          } else {
            // DD-MM-YYYY format (from API)
            return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          }
        }
        return null;
      }).filter(d => d && !isNaN(d.getTime()));
      
      if (dates.length > 0) {
        const mostRecent = new Date(Math.max(...dates));
        const lastDay = mostRecent.getDate();
        const lastMonth = monthNames[mostRecent.getMonth()];
        lastUpdatedText = `(${t('lastUpdatedOn')} ${lastDay} ${lastMonth})`;
      }
    }
    
    if (lastUpdatedText) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lastUpdatedText, canvasWidth / 2, 92);
    }
  }

  /**
   * Draw table with commodity prices
   */
  async drawTable(ctx, priceData, startY, canvasWidth, isHistorical = false, t = (key) => key) {
    const padding = 30;
    const tableWidth = canvasWidth - (padding * 2);
    const tableX = padding;
    
    // Column widths - Optimized for portrait layout (total must fit in 540px)
    const imageColWidth = 60;
    const nameColWidth = 150;
    const minColWidth = 110;
    const modalColWidth = 110;
    const maxColWidth = 110;
    
    const headerRowHeight = 70;
    const rowHeight = 90;
    
    // Detect duplicate commodity names
    const commodityCount = {};
    priceData.forEach(item => {
      const commodity = item.commodity || 'N/A';
      commodityCount[commodity] = (commodityCount[commodity] || 0) + 1;
    });
    
    // Draw table header
    let currentY = startY;
    
    // Header background - green
    ctx.fillStyle = '#059669';
    ctx.fillRect(tableX, currentY, tableWidth, headerRowHeight);
    
    // Header borders
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    // Draw header cells and text
    let currentX = tableX;
    
    // Empty cell for image column
    ctx.strokeRect(currentX, currentY, imageColWidth, headerRowHeight);
    currentX += imageColWidth;
    
    // Commodity Name header
    ctx.strokeRect(currentX, currentY, nameColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('commodity'), currentX + nameColWidth / 2, currentY + 30);
    ctx.fillText(t('commodityName').split(' ')[1] || '', currentX + nameColWidth / 2, currentY + 50);
    currentX += nameColWidth;
    
    // Min Price header
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(currentX, currentY, minColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t('min'), currentX + minColWidth / 2, currentY + 30);
    ctx.fillText(t('priceMovement').includes(t('priceMovement')) ? 'Price' : '', currentX + minColWidth / 2, currentY + 50);
    currentX += minColWidth;
    
    // Modal Price header
    ctx.strokeRect(currentX, currentY, modalColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t('modal'), currentX + modalColWidth / 2, currentY + 30);
    ctx.fillText('', currentX + modalColWidth / 2, currentY + 50);
    currentX += modalColWidth;
    
    // Max Price header
    ctx.strokeRect(currentX, currentY, maxColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t('max'), currentX + maxColWidth / 2, currentY + 30);
    ctx.fillText('', currentX + maxColWidth / 2, currentY + 50);
    
    currentY += headerRowHeight;
    
    // Draw data rows
    for (let i = 0; i < priceData.length; i++) {
      await this.drawTableRow(ctx, priceData[i], tableX, currentY, 
        imageColWidth, nameColWidth, minColWidth, modalColWidth, maxColWidth, rowHeight, i, commodityCount, isHistorical);
      currentY += rowHeight;
    }
  }
  
  /**
   * Draw a single table row
   */
  async drawTableRow(ctx, price, x, y, imageColWidth, nameColWidth, minColWidth, modalColWidth, maxColWidth, rowHeight, index, commodityCount = {}, isHistorical = false) {
    // Alternating row colors - softer contrast
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    const totalWidth = imageColWidth + nameColWidth + minColWidth + modalColWidth + maxColWidth;
    ctx.fillRect(x, y, totalWidth, rowHeight);
    
    // Row borders
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    
    let currentX = x;
    
    // Image cell
    ctx.strokeRect(currentX, y, imageColWidth, rowHeight);
    
    // Draw commodity image - optimized for portrait
    const imageSize = 45;
    const imageX = currentX + (imageColWidth - imageSize) / 2;
    const imageY = y + (rowHeight - imageSize) / 2;
    
    try {
      const imagePath = commodityImageService.getCommodityImagePath(price.commodity);
      if (imagePath) {
        const img = await this.loadImage(imagePath);
        ctx.save();
        ctx.beginPath();
        ctx.arc(imageX + imageSize / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, imageX, imageY, imageSize, imageSize);
        ctx.restore();
      }
    } catch (error) {
      // Draw placeholder circle
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(imageX + imageSize / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    currentX += imageColWidth;
    
    // Commodity name cell with text wrapping
    ctx.strokeRect(currentX, y, nameColWidth, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Determine if we should show variety (when there are duplicates)
    const commodityName = price.commodity || 'N/A';
    const hasDuplicates = commodityCount[commodityName] > 1;
    const variety = price.variety || 'N/A';
    
    // Build display name: show variety if there are duplicates
    let displayName = commodityName;
    if (hasDuplicates && variety && variety !== 'N/A') {
      displayName = `${commodityName} (${variety})`;
    }
    
    // Wrap text if needed
    const maxWidth = nameColWidth - 10; // padding
    const words = displayName.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    // Draw wrapped lines
    const lineHeight = 18;
    const dateSpace = 16; // Space for date
    const totalHeight = (lines.length * lineHeight) + dateSpace;
    let textY = y + (rowHeight - totalHeight) / 2 + 13;
    
    lines.forEach(line => {
      ctx.fillText(line, currentX + nameColWidth / 2, textY);
      textY += lineHeight;
    });
    
    // Draw date/year below commodity name
    if (price.arrivalDate) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Arial, sans-serif';
      
      // For historical data, show only the year
      // For current data, show the full date
      const displayText = isHistorical 
        ? this.extractYear(price.arrivalDate)
        : this.formatDateCompact(price.arrivalDate);
      
      ctx.fillText(displayText, currentX + nameColWidth / 2, textY + 3);
    }
    
    currentX += nameColWidth;
    
    // Min price cell
    ctx.strokeRect(currentX, y, minColWidth, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(formatPrice(price.minPrice), currentX + minColWidth / 2, y + rowHeight / 2 + 8);
    currentX += minColWidth;
    
    // Modal price cell - red color
    ctx.strokeRect(currentX, y, modalColWidth, rowHeight);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(formatPrice(price.modalPrice), currentX + modalColWidth / 2, y + rowHeight / 2 + 8);
    currentX += modalColWidth;
    
    // Max price cell
    ctx.strokeRect(currentX, y, maxColWidth, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(formatPrice(price.maxPrice), currentX + maxColWidth / 2, y + rowHeight / 2 + 8);
  }


  /**
   * Draw footer
   */
  drawFooter(ctx, y, canvasWidth, canvasHeight, pageNumber, totalPages) {
    // Footer background - green
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, y, canvasWidth, canvasHeight - y);

    // Footer text
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    let footerText = 'AgriGuru - Market Price Information';
    if (totalPages > 1) {
      footerText += ` (Page ${pageNumber}/${totalPages})`;
    }
    
    ctx.fillText(footerText, canvasWidth / 2, y + 30);
  }

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Date N/A';
    
    // Parse DD/MM/YYYY or DD-MM-YYYY format
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    }
    
    return dateStr;
  }

  /**
   * Format date compactly for display (DD MMM)
   */
  formatDateCompact(dateStr) {
    if (!dateStr) return '';
    
    try {
      // Parse date - handle both YYYY-MM-DD (from DB) and DD-MM-YYYY (from API) formats
      const parts = dateStr.split(/[-/]/);
      if (parts.length !== 3) return dateStr;
      
      let day, month;
      
      // Detect format: if first part is 4 digits, it's YYYY-MM-DD, else DD-MM-YYYY
      if (parts[0].length === 4) {
        // YYYY-MM-DD format (from database)
        day = parseInt(parts[2], 10);
        month = parseInt(parts[1], 10) - 1; // 0-indexed
      } else {
        // DD-MM-YYYY format (from API)
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1; // 0-indexed
      }
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      return `${day} ${monthNames[month]}`;
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Extract year from date string for historical data display
   */
  extractYear(dateStr) {
    if (!dateStr) return '';
    
    try {
      // Parse date - handle both YYYY-MM-DD (from DB) and DD-MM-YYYY (from API) formats
      const parts = dateStr.split(/[-/]/);
      if (parts.length !== 3) return dateStr;
      
      // Detect format: if first part is 4 digits, it's YYYY-MM-DD, else DD-MM-YYYY
      if (parts[0].length === 4) {
        // YYYY-MM-DD format (from database)
        return parts[0];
      } else {
        // DD-MM-YYYY format (from API)
        return parts[2];
      }
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Load image from URL
   * @param {string} src - Image source URL
   * @returns {Promise<Image>}
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Draw rounded rectangle path
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Truncate text if it exceeds maxWidth
   */
  truncateText(ctx, text, maxWidth) {
    const ellipsis = '...';
    const textWidth = ctx.measureText(text).width;
    
    if (textWidth <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + ellipsis;
  }

  /**
   * Download image as PNG file
   */
  downloadImage(dataUrl, filename = 'market-prices.png') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate and download market price images (with pagination)
   */
  async generateAndDownload(priceData, marketInfo = {}) {
    try {
      const imageDataUrls = await this.generateMarketPriceImages(priceData, marketInfo);
      
      // Create filename with market name and date
      const marketName = (marketInfo.market || marketInfo.district || 'market')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Download each image
      imageDataUrls.forEach((imageUrl, index) => {
        const filename = imageDataUrls.length > 1 
          ? `${marketName}-prices-${dateStr}-page${index + 1}.png`
          : `${marketName}-prices-${dateStr}.png`;
        this.downloadImage(imageUrl, filename);
      });
      
      const message = imageDataUrls.length > 1 
        ? `${imageDataUrls.length} images downloaded successfully`
        : 'Image downloaded successfully';
      
      return { success: true, message, images: imageDataUrls };
    } catch (error) {
      console.error('Error generating market image:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get cached images for a market
   * @param {Object} marketInfo - Market information
   * @param {number} totalPages - Total number of pages expected
   * @param {boolean} isHistorical - Whether this is historical data
   * @returns {Promise<Array|null>} Array of cached image URLs or null
   */
  async getCachedImages(marketInfo, totalPages, isHistorical) {
    try {
      const market = marketInfo.market || marketInfo.district || 'market';
      const cacheKeys = [];
      
      // Generate cache keys for all pages
      for (let page = 1; page <= totalPages; page++) {
        const cacheKey = imageCacheService.generateCacheKey({
          market,
          commodity: null, // Market-wide images don't have specific commodity
          date: null, // Use today's date
          pageNumber: page,
          isHistorical
        });
        cacheKeys.push(cacheKey);
      }

      // Fetch all cached images
      const cachedData = await imageCacheService.getCachedImages(cacheKeys);
      
      // Check if all pages are cached
      const images = [];
      for (const key of cacheKeys) {
        if (!cachedData[key] || !cachedData[key].image_data) {
          // Cache miss - return null to regenerate all
          return null;
        }
        images.push(cachedData[key].image_data);
      }

      return images;
    } catch (error) {
      console.error('Error fetching cached images:', error);
      return null;
    }
  }

  /**
   * Cache generated images
   * @param {Array} images - Array of image data URLs
   * @param {Object} marketInfo - Market information
   * @param {number} totalPages - Total number of pages
   * @param {boolean} isHistorical - Whether this is historical data
   * @returns {Promise<void>}
   */
  async cacheImages(images, marketInfo, totalPages, isHistorical) {
    try {
      const market = marketInfo.market || marketInfo.district || 'market';
      const district = marketInfo.district || null;
      const state = marketInfo.state || null;

      const cacheConfigs = images.map((imageData, index) => {
        const pageNumber = index + 1;
        const cacheKey = imageCacheService.generateCacheKey({
          market,
          commodity: null,
          date: null,
          pageNumber,
          isHistorical
        });

        return {
          cacheKey,
          imageData,
          market,
          district,
          state,
          commodity: null, // Market-wide images
          pageNumber,
          totalPages,
          isHistorical
        };
      });

      // Store all images in parallel
      await imageCacheService.storeCachedImages(cacheConfigs);
      console.log(`✓ Cached ${images.length} market images`);
    } catch (error) {
      console.error('Error caching images:', error);
    }
  }
}

export default new MarketImageService();
