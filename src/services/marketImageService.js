/**
 * Service to generate market price images for download
 * Uses HTML5 Canvas API to create clean table-based images
 * Enhanced to match professional market price boards
 */

import commodityImageService from './commodityImageService';

class MarketImageService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Generate multiple images with market commodity prices (pagination)
   * @param {Array} priceData - Array of price data objects
   * @param {Object} marketInfo - Market information (name, district, state)
   * @param {number} itemsPerPage - Number of items per image (default: 12 for table layout)
   * @returns {Promise<Array>} - Array of Base64 image data URLs
   */
  async generateMarketPriceImages(priceData, marketInfo = {}, itemsPerPage = 12) {
    if (!priceData || priceData.length === 0) {
      throw new Error('No price data available to generate image');
    }

    // Split data into pages
    const pages = [];
    for (let i = 0; i < priceData.length; i += itemsPerPage) {
      pages.push(priceData.slice(i, i + itemsPerPage));
    }

    console.log(`Generating ${pages.length} images for ${priceData.length} items`);

    // Generate each page
    const images = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageData = pages[pageIndex];
      const imageUrl = await this.generateSinglePageImage(
        pageData, 
        marketInfo, 
        pageIndex + 1, 
        pages.length
      );
      images.push(imageUrl);
    }

    return images;
  }

  /**
   * Generate a single page image with market commodity prices in table format
   * @param {Array} priceData - Array of price data objects for this page
   * @param {Object} marketInfo - Market information (name, district, state)
   * @param {number} pageNumber - Current page number
   * @param {number} totalPages - Total number of pages
   * @returns {Promise<string>} - Base64 image data URL
   */
  async generateSinglePageImage(priceData, marketInfo = {}, pageNumber = 1, totalPages = 1) {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Table dimensions
    const rowHeight = 85;
    const headerRowHeight = 100;
    const titleHeight = 130;
    const footerHeight = 50;
    const canvasWidth = 1400;
    const canvasHeight = titleHeight + headerRowHeight + (priceData.length * rowHeight) + footerHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background - white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title section
    this.drawTitleSection(ctx, marketInfo, canvasWidth);

    // Draw table
    const tableY = titleHeight;
    await this.drawTable(ctx, priceData, tableY, canvasWidth);

    // Footer
    this.drawFooter(ctx, canvasHeight - footerHeight, canvasWidth, canvasHeight, pageNumber, totalPages);

    // Convert canvas to image
    return canvas.toDataURL('image/png');
  }

  /**
   * Draw title section with market name and date
   */
  drawTitleSection(ctx, marketInfo, canvasWidth) {
    const padding = 30;
    
    // Market name - centered, large
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    const location = marketInfo.district && marketInfo.state 
      ? `${marketInfo.district}, ${marketInfo.state}` 
      : marketInfo.state || '';
    
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${marketName} Market Price Board`, canvasWidth / 2, 55);

    // Decorative line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padding, 75);
    ctx.lineTo(canvasWidth - padding, 75);
    ctx.stroke();

    // Date - large and prominent
    const today = new Date();
    const day = today.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[today.getMonth()];
    const year = today.getFullYear();
    
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${day} ${month} ${year}`, canvasWidth / 2, 115);
  }

  /**
   * Draw table with commodity prices
   */
  async drawTable(ctx, priceData, startY, canvasWidth) {
    const padding = 30;
    const tableWidth = canvasWidth - (padding * 2);
    const tableX = padding;
    
    // Column widths
    const imageColWidth = 120;
    const nameColWidth = 380;
    const minColWidth = 280;
    const modalColWidth = 280;
    const maxColWidth = 280;
    
    const headerRowHeight = 100;
    const rowHeight = 85;
    
    // Draw table header
    let currentY = startY;
    
    // Header background
    ctx.fillStyle = '#dc2626';
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
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Commodity Name', currentX + nameColWidth / 2, currentY + 60);
    currentX += nameColWidth;
    
    // Min Price header
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(currentX, currentY, minColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Minimum Price', currentX + minColWidth / 2, currentY + 60);
    currentX += minColWidth;
    
    // Modal Price header
    ctx.strokeRect(currentX, currentY, modalColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Modal Price', currentX + modalColWidth / 2, currentY + 60);
    currentX += modalColWidth;
    
    // Max Price header
    ctx.strokeRect(currentX, currentY, maxColWidth, headerRowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Maximum Price', currentX + maxColWidth / 2, currentY + 60);
    
    currentY += headerRowHeight;
    
    // Draw data rows
    for (let i = 0; i < priceData.length; i++) {
      await this.drawTableRow(ctx, priceData[i], tableX, currentY, 
        imageColWidth, nameColWidth, minColWidth, modalColWidth, maxColWidth, rowHeight, i);
      currentY += rowHeight;
    }
  }
  
  /**
   * Draw a single table row
   */
  async drawTableRow(ctx, price, x, y, imageColWidth, nameColWidth, minColWidth, modalColWidth, maxColWidth, rowHeight, index) {
    // Alternating row colors
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    const totalWidth = imageColWidth + nameColWidth + minColWidth + modalColWidth + maxColWidth;
    ctx.fillRect(x, y, totalWidth, rowHeight);
    
    // Row borders
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    
    let currentX = x;
    
    // Image cell
    ctx.strokeRect(currentX, y, imageColWidth, rowHeight);
    
    // Draw commodity image
    const imageSize = 60;
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
    
    // Commodity name cell
    ctx.strokeRect(currentX, y, nameColWidth, rowHeight);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(price.commodity, currentX + nameColWidth / 2, y + rowHeight / 2 + 10);
    currentX += nameColWidth;
    
    // Min price cell
    ctx.strokeRect(currentX, y, minColWidth, rowHeight);
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText(price.minPrice || 'N/A', currentX + minColWidth / 2, y + rowHeight / 2 + 12);
    currentX += minColWidth;
    
    // Modal price cell  
    ctx.strokeRect(currentX, y, modalColWidth, rowHeight);
    ctx.fillStyle = '#1e40af';
    ctx.fillText(price.modalPrice || 'N/A', currentX + modalColWidth / 2, y + rowHeight / 2 + 12);
    currentX += modalColWidth;
    
    // Max price cell
    ctx.strokeRect(currentX, y, maxColWidth, rowHeight);
    ctx.fillStyle = '#dc2626';
    ctx.fillText(price.maxPrice || 'N/A', currentX + maxColWidth / 2, y + rowHeight / 2 + 12);
  }


  /**
   * Draw footer
   */
  drawFooter(ctx, y, canvasWidth, canvasHeight, pageNumber, totalPages) {
    // Footer background - green
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, y, canvasWidth, canvasHeight - y);

    // Footer text
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    let footerText = 'AgriGuru - Market Price Information';
    if (totalPages > 1) {
      footerText += ` (Page ${pageNumber}/${totalPages})`;
    }
    
    ctx.fillText(footerText, canvasWidth / 2, y + 35);
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
}

export default new MarketImageService();
