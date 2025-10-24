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
   * Generate an image with all market commodity prices
   * @param {Array} priceData - Array of price data objects
   * @param {Object} marketInfo - Market information (name, district, state)
   * @returns {Promise<string>} - Base64 image data URL
   */
  async generateMarketPriceImage(priceData, marketInfo = {}) {
    if (!priceData || priceData.length === 0) {
      throw new Error('No price data available to generate image');
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate canvas dimensions based on number of items
    const itemHeight = 140; // Height per commodity item
    const headerHeight = 180;
    const footerHeight = 60;
    const padding = 30;
    const canvasWidth = 1200;
    const canvasHeight = headerHeight + (priceData.length * itemHeight) + footerHeight + (padding * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header section
    this.drawHeader(ctx, marketInfo, padding, canvasWidth);

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
   * Draw header section with market name and date
   */
  drawHeader(ctx, marketInfo, padding, canvasWidth) {
    // Gradient background for header
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradient.addColorStop(0, '#0891b2');
    gradient.addColorStop(1, '#0e7490');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, 150);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AgriGuru Market Prices', padding, 60);

    // Market name
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    const location = marketInfo.district && marketInfo.state 
      ? `${marketInfo.district}, ${marketInfo.state}` 
      : marketInfo.state || '';
    
    ctx.font = '28px Arial, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(marketName, padding, 105);

    if (location) {
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = '#bae6fd';
      ctx.fillText(location, padding, 135);
    }

    // Date
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`Date: ${today}`, canvasWidth - padding, 135);
  }

  /**
   * Draw individual price card
   */
  drawPriceCard(ctx, price, x, y, width, index) {
    const cardHeight = 120;
    
    // Alternate background colors
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f1f5f9';
    ctx.fillRect(x, y, width, cardHeight);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, cardHeight);

    // Commodity name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'left';
    const commodityText = this.truncateText(ctx, price.commodity, width - 500);
    ctx.fillText(commodityText, x + 20, y + 35);

    // Variety (if available)
    if (price.variety && price.variety !== 'N/A') {
      ctx.font = '16px Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      const varietyText = this.truncateText(ctx, `(${price.variety})`, width - 500);
      ctx.fillText(varietyText, x + 20, y + 60);
    }

    // Market name
    ctx.font = '16px Arial, sans-serif';
    ctx.fillStyle = '#475569';
    const marketText = this.truncateText(ctx, `${price.market}, ${price.district}`, width - 500);
    ctx.fillText(marketText, x + 20, y + 85);

    // Date
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(this.formatDate(price.arrivalDate), x + 20, y + 105);

    // Prices section (right side)
    const priceX = x + width - 450;
    
    // Min Price
    this.drawPriceBox(ctx, 'Min', price.minPrice, priceX, y + 20, '#10b981');
    
    // Modal Price
    this.drawPriceBox(ctx, 'Modal', price.modalPrice, priceX + 150, y + 20, '#ef4444');
    
    // Max Price
    this.drawPriceBox(ctx, 'Max', price.maxPrice, priceX + 300, y + 20, '#10b981');
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
   * Generate and download market price image
   */
  async generateAndDownload(priceData, marketInfo = {}) {
    try {
      const imageDataUrl = await this.generateMarketPriceImage(priceData, marketInfo);
      
      // Create filename with market name and date
      const marketName = (marketInfo.market || marketInfo.district || 'market')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${marketName}-prices-${dateStr}.png`;
      
      this.downloadImage(imageDataUrl, filename);
      
      return { success: true, message: 'Image downloaded successfully' };
    } catch (error) {
      console.error('Error generating market image:', error);
      return { success: false, message: error.message };
    }
  }
}

export default new MarketImageService();
