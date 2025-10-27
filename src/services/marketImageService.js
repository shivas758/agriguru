/**
 * Service to generate market price images for download
 * Uses HTML5 Canvas API to create images showing all commodity prices
 */

class MarketImageService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Generate multiple images with market commodity prices (pagination)
   * @param {Array} priceData - Array of price data objects
   * @param {Object} marketInfo - Market information (name, district, state)
   * @param {number} itemsPerPage - Number of items per image (default: 10)
   * @returns {Promise<Array>} - Array of Base64 image data URLs
   */
  async generateMarketPriceImages(priceData, marketInfo = {}, itemsPerPage = 10) {
    if (!priceData || priceData.length === 0) {
      throw new Error('No price data available to generate image');
    }

    // Split data into pages
    const pages = [];
    for (let i = 0; i < priceData.length; i += itemsPerPage) {
      pages.push(priceData.slice(i, i + itemsPerPage));
    }

    // DEBUG: Uncommented for debugging
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
   * Generate a single page image with market commodity prices
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

    // Calculate canvas dimensions based on number of items
    const itemHeight = 110; // Reduced height per commodity item
    const headerHeight = 120; // Reduced header height
    const footerHeight = 60;
    const padding = 20; // Reduced padding
    const canvasWidth = 1200;
    const canvasHeight = headerHeight + (priceData.length * itemHeight) + footerHeight + (padding * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header section
    this.drawHeader(ctx, marketInfo, padding, canvasWidth, pageNumber, totalPages);

    // Draw each commodity price card
    let yPosition = headerHeight + padding;
    priceData.forEach((price, index) => {
      this.drawPriceCard(ctx, price, padding, yPosition, canvasWidth - (padding * 2), index);
      yPosition += itemHeight;
    });

    // Footer
    this.drawFooter(ctx, yPosition, canvasWidth, canvasHeight);

    // Convert canvas to image
    return canvas.toDataURL('image/png');
  }

  /**
   * Draw header section with logo, market name (centered), and date
   */
  drawHeader(ctx, marketInfo, padding, canvasWidth, pageNumber = 1, totalPages = 1) {
    // Gradient background for header
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradient.addColorStop(0, '#0891b2');
    gradient.addColorStop(1, '#0e7490');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, 100);

    // Logo on the left (circular placeholder)
    const logoSize = 60;
    const logoX = padding + 20;
    const logoY = 50;
    
    // Draw circular logo background
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Logo text
    ctx.fillStyle = '#0891b2';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AG', logoX, logoY + 7);

    // Market name in the center
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    const location = marketInfo.district && marketInfo.state 
      ? `${marketInfo.district}, ${marketInfo.state}` 
      : marketInfo.state || '';
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marketName, canvasWidth / 2, 45);

    if (location) {
      ctx.font = '16px Arial, sans-serif';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(location, canvasWidth / 2, 70);
    }

    // Date on the right (same visual weight as logo)
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    
    const dateX = canvasWidth - padding - 20;
    const dateY = 50;
    
    // Date circle background
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dateX, dateY, logoSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Date text (split into lines)
    ctx.fillStyle = '#0891b2';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    const dateParts = today.split(' ');
    if (dateParts.length >= 3) {
      ctx.fillText(dateParts[0], dateX, dateY - 8); // Day
      ctx.fillText(dateParts[1], dateX, dateY + 6); // Month
      ctx.font = '11px Arial, sans-serif';
      ctx.fillText(dateParts[2], dateX, dateY + 18); // Year
    } else {
      ctx.fillText(today, dateX, dateY + 5);
    }

    // Page number (if multiple pages)
    if (totalPages > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Page ${pageNumber} of ${totalPages}`, canvasWidth / 2, 92);
    }
  }

  /**
   * Draw individual price card with reduced horizontal spacing
   */
  drawPriceCard(ctx, price, x, y, width, index) {
    const cardHeight = 90; // Reduced card height
    
    // Alternate background colors
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f1f5f9';
    ctx.fillRect(x, y, width, cardHeight);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, cardHeight);

    // Left section: Commodity info (reduced width)
    const leftSectionWidth = width * 0.45; // 45% of width
    
    // Commodity name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    const commodityText = this.truncateText(ctx, price.commodity, leftSectionWidth - 30);
    ctx.fillText(commodityText, x + 15, y + 28);

    // Variety (if available) - inline with reduced space
    if (price.variety && price.variety !== 'N/A') {
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      const varietyText = this.truncateText(ctx, `(${price.variety})`, leftSectionWidth - 30);
      ctx.fillText(varietyText, x + 15, y + 50);
    }

    // Market name
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#475569';
    const marketText = this.truncateText(ctx, `${price.market}, ${price.district}`, leftSectionWidth - 30);
    ctx.fillText(marketText, x + 15, y + 70);

    // Prices section (right side) - closer to commodity info
    const priceX = x + leftSectionWidth + 20; // Reduced gap
    const priceSpacing = 130; // Reduced spacing between price boxes
    
    // Min Price
    this.drawPriceBox(ctx, 'Min', price.minPrice, priceX, y + 18, '#10b981');
    
    // Modal Price
    this.drawPriceBox(ctx, 'Modal', price.modalPrice, priceX + priceSpacing, y + 18, '#ef4444');
    
    // Max Price
    this.drawPriceBox(ctx, 'Max', price.maxPrice, priceX + priceSpacing * 2, y + 18, '#10b981');
  }

  /**
   * Draw price box with label and value
   */
  drawPriceBox(ctx, label, value, x, y, color) {
    // Label
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 60, y);

    // Price
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(`₹${value}`, x + 60, y + 30);

    // Unit
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('/qtl', x + 60, y + 48);
  }

  /**
   * Draw footer
   */
  drawFooter(ctx, y, canvasWidth, canvasHeight) {
    // Footer background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, canvasHeight - 60, canvasWidth, 60);

    // Footer text
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Generated by AgriGuru - Your Agricultural Market Price Assistant',
      canvasWidth / 2,
      canvasHeight - 30
    );

    // Disclaimer
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      'Prices are indicative and subject to market variations',
      canvasWidth / 2,
      canvasHeight - 10
    );
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
