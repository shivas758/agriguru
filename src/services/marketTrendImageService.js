/**
 * Market Trend Image Service
 * Generates visual images for market-wide price trends
 * Shows price changes, trend directions, and comparisons
 */

import commodityImageService from './commodityImageService';

class MarketTrendImageService {
  /**
   * Generate trend image for multiple commodities
   */
  async generateTrendImages(trendsData, marketInfo = {}, itemsPerPage = 10) {
    if (!trendsData || !trendsData.commodities || trendsData.commodities.length === 0) {
      throw new Error('No trend data available to generate image');
    }

    const commodities = trendsData.commodities;

    // Split into pages
    const pages = [];
    for (let i = 0; i < commodities.length; i += itemsPerPage) {
      pages.push(commodities.slice(i, i + itemsPerPage));
    }

    console.log(`Generating ${pages.length} trend images for ${commodities.length} commodities`);

    // Generate each page
    const images = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageData = pages[pageIndex];
      const imageUrl = await this.generateSingleTrendImage(
        pageData, 
        marketInfo,
        trendsData.dateRange,
        pageIndex + 1, 
        pages.length
      );
      images.push(imageUrl);
    }

    return images;
  }

  /**
   * Generate a single trend image
   */
  async generateSingleTrendImage(trends, marketInfo = {}, dateRange = {}, pageNumber = 1, totalPages = 1) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Canvas dimensions
    const rowHeight = 90;
    const headerRowHeight = 100;
    const titleHeight = 160;
    const footerHeight = 50;
    const canvasWidth = 1600;
    const canvasHeight = titleHeight + headerRowHeight + (trends.length * rowHeight) + footerHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title
    this.drawTitleSection(ctx, marketInfo, dateRange, canvasWidth);

    // Draw table
    const tableY = titleHeight;
    await this.drawTrendTable(ctx, trends, tableY, canvasWidth);

    // Footer
    this.drawFooter(ctx, canvasHeight - footerHeight, canvasWidth, canvasHeight, pageNumber, totalPages);

    return canvas.toDataURL('image/png');
  }

  /**
   * Draw title section
   */
  drawTitleSection(ctx, marketInfo, dateRange, canvasWidth) {
    const padding = 30;
    
    // Title
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${marketName} - Price Trends`, canvasWidth / 2, 55);

    // Decorative line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padding, 75);
    ctx.lineTo(canvasWidth - padding, 75);
    ctx.stroke();

    // Date range
    const oldestDate = this.formatDate(dateRange.oldest);
    const newestDate = this.formatDate(dateRange.newest);
    
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${oldestDate} to ${newestDate}`, canvasWidth / 2, 120);

    // Subtitle
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('Last 30 Days Price Movement', canvasWidth / 2, 150);
  }

  /**
   * Draw trend table
   */
  async drawTrendTable(ctx, trends, startY, canvasWidth) {
    const padding = 30;
    const tableWidth = canvasWidth - (padding * 2);
    const tableX = padding;
    
    // Column widths
    const imageColWidth = 100;
    const nameColWidth = 320;
    const oldPriceColWidth = 220;
    const newPriceColWidth = 220;
    const changeColWidth = 220;
    const percentColWidth = 220;
    const trendColWidth = 300;
    
    const headerRowHeight = 100;
    const rowHeight = 90;
    
    // Draw header
    let currentY = startY;
    
    // Header background
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(tableX, currentY, tableWidth, headerRowHeight);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    let currentX = tableX;
    
    // Empty cell for image
    ctx.strokeRect(currentX, currentY, imageColWidth, headerRowHeight);
    currentX += imageColWidth;
    
    // Headers
    const headers = [
      { text: 'Commodity', width: nameColWidth },
      { text: 'Old Price', width: oldPriceColWidth },
      { text: 'Current Price', width: newPriceColWidth },
      { text: 'Change', width: changeColWidth },
      { text: 'Change %', width: percentColWidth },
      { text: 'Trend', width: trendColWidth }
    ];
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    for (const header of headers) {
      ctx.strokeRect(currentX, currentY, header.width, headerRowHeight);
      ctx.fillText(header.text, currentX + header.width / 2, currentY + 60);
      currentX += header.width;
    }
    
    currentY += headerRowHeight;
    
    // Draw data rows
    for (let i = 0; i < trends.length; i++) {
      await this.drawTrendRow(
        ctx, 
        trends[i], 
        tableX, 
        currentY, 
        imageColWidth,
        nameColWidth,
        oldPriceColWidth,
        newPriceColWidth,
        changeColWidth,
        percentColWidth,
        trendColWidth,
        rowHeight, 
        i
      );
      currentY += rowHeight;
    }
  }

  /**
   * Draw a single trend row
   */
  async drawTrendRow(ctx, trend, x, y, imageColWidth, nameColWidth, oldPriceColWidth, newPriceColWidth, changeColWidth, percentColWidth, trendColWidth, rowHeight, index) {
    // Alternating row colors
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    const totalWidth = imageColWidth + nameColWidth + oldPriceColWidth + newPriceColWidth + changeColWidth + percentColWidth + trendColWidth;
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
      const imagePath = commodityImageService.getCommodityImagePath(trend.commodity);
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
      // Placeholder
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(imageX + imageSize / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    currentX += imageColWidth;
    
    // Commodity name
    ctx.strokeRect(currentX, y, nameColWidth, rowHeight);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(trend.commodity, currentX + nameColWidth / 2, y + rowHeight / 2 + 10);
    currentX += nameColWidth;
    
    // Old price
    ctx.strokeRect(currentX, y, oldPriceColWidth, rowHeight);
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(`₹${trend.oldPrice}`, currentX + oldPriceColWidth / 2, y + rowHeight / 2 + 10);
    currentX += oldPriceColWidth;
    
    // Current price
    ctx.strokeRect(currentX, y, newPriceColWidth, rowHeight);
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText(`₹${trend.currentPrice}`, currentX + newPriceColWidth / 2, y + rowHeight / 2 + 12);
    currentX += newPriceColWidth;
    
    // Price change
    const changeColor = trend.priceChange >= 0 ? '#059669' : '#dc2626';
    const changePrefix = trend.priceChange >= 0 ? '+' : '';
    
    ctx.strokeRect(currentX, y, changeColWidth, rowHeight);
    ctx.fillStyle = changeColor;
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText(`${changePrefix}₹${trend.priceChange}`, currentX + changeColWidth / 2, y + rowHeight / 2 + 12);
    currentX += changeColWidth;
    
    // Percent change
    ctx.strokeRect(currentX, y, percentColWidth, rowHeight);
    ctx.fillStyle = changeColor;
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText(`${changePrefix}${trend.percentChange}%`, currentX + percentColWidth / 2, y + rowHeight / 2 + 12);
    currentX += percentColWidth;
    
    // Trend indicator
    ctx.strokeRect(currentX, y, trendColWidth, rowHeight);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Arial, sans-serif';
    
    // Draw trend arrow
    const arrowX = currentX + 40;
    const arrowY = y + rowHeight / 2;
    
    if (trend.direction === 'increasing') {
      // Up arrow
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 10);
      ctx.lineTo(arrowX - 15, arrowY + 25);
      ctx.lineTo(arrowX + 15, arrowY + 25);
      ctx.fill();
    } else if (trend.direction === 'decreasing') {
      // Down arrow
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 25);
      ctx.lineTo(arrowX - 15, arrowY + 10);
      ctx.lineTo(arrowX + 15, arrowY + 10);
      ctx.fill();
    } else {
      // Flat arrow
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(arrowX - 15, arrowY + 15, 30, 6);
    }
    
    // Trend text
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(this.capitalizeFirst(trend.trendStrength), arrowX + 30, y + rowHeight / 2 + 10);
  }

  /**
   * Draw footer
   */
  drawFooter(ctx, y, canvasWidth, canvasHeight, pageNumber, totalPages) {
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, y, canvasWidth, canvasHeight - y);

    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    let footerText = 'AgriGuru - Price Trend Analysis (Last 30 Days)';
    if (totalPages > 1) {
      footerText += ` (Page ${pageNumber}/${totalPages})`;
    }
    
    ctx.fillText(footerText, canvasWidth / 2, y + 35);
  }

  /**
   * Format date
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Load image
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Download images
   */
  downloadImage(dataUrl, filename = 'market-trends.png') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate and download trend images
   */
  async generateAndDownload(trendsData, marketInfo = {}) {
    try {
      const imageDataUrls = await this.generateTrendImages(trendsData, marketInfo);
      
      const marketName = (marketInfo.market || marketInfo.district || 'market')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      
      imageDataUrls.forEach((imageUrl, index) => {
        const filename = imageDataUrls.length > 1 
          ? `${marketName}-trends-${dateStr}-page${index + 1}.png`
          : `${marketName}-trends-${dateStr}.png`;
        this.downloadImage(imageUrl, filename);
      });
      
      const message = imageDataUrls.length > 1 
        ? `${imageDataUrls.length} trend images downloaded successfully`
        : 'Trend image downloaded successfully';
      
      return { success: true, message, images: imageDataUrls };
    } catch (error) {
      console.error('Error generating trend image:', error);
      return { success: false, message: error.message };
    }
  }
}

export default new MarketTrendImageService();
