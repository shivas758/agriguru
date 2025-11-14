/**
 * Market Trend Image Service
 * Generates visual images for market-wide price trends
 * Shows price changes, trend directions, and comparisons
 */

import commodityImageService from './commodityImageService';
import { getTranslation } from '../config/translations';

class MarketTrendImageService {
  /**
   * Generate trend image for multiple commodities
   */
  async generateTrendImages(trendsData, marketInfo = {}, itemsPerPage = 10, language = 'en') {
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
        pages.length,
        language
      );
      images.push(imageUrl);
    }

    return images;
  }

  /**
   * Generate a single trend image
   */
  async generateSingleTrendImage(trends, marketInfo = {}, dateRange = {}, pageNumber = 1, totalPages = 1, language = 'en') {
    const t = (key) => getTranslation(language, key);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Canvas dimensions - Portrait layout for mobile with 2x resolution for sharpness
    const scale = 2; // High resolution multiplier
    const rowHeight = 85 * scale;
    const headerRowHeight = 70 * scale;
    const titleHeight = 110 * scale;
    const footerHeight = 45 * scale;
    const canvasWidth = 600 * scale; // Portrait width at 2x resolution
    const canvasHeight = titleHeight + headerRowHeight + (trends.length * rowHeight) + footerHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Scale context for high resolution
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title (pass unscaled width)
    this.drawTitleSection(ctx, marketInfo, dateRange, canvasWidth / scale, t);

    // Draw table (pass unscaled values)
    const tableY = titleHeight / scale;
    await this.drawTrendTable(ctx, trends, tableY, canvasWidth / scale, t);

    // Footer (pass unscaled values)
    this.drawFooter(ctx, (canvasHeight - footerHeight) / scale, canvasWidth / scale, canvasHeight / scale, pageNumber, totalPages);

    return canvas.toDataURL('image/png');
  }

  /**
   * Draw title section
   */
  drawTitleSection(ctx, marketInfo, dateRange, canvasWidth, t = (key) => key) {
    const padding = 30;
    
    // Title
    const marketName = marketInfo.market || marketInfo.district || 'Market';
    
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${marketName} - ${t('priceTrends')}`, canvasWidth / 2, 40);

    // Date range - compact
    const startDate = dateRange.start || '';
    const endDate = dateRange.end || '';
    let dateText = '';
    
    if (startDate && endDate) {
      dateText = `${startDate} to ${endDate}`;
    } else if (endDate) {
      dateText = `As of ${endDate}`;
    }
    
    if (dateText) {
      ctx.fillStyle = '#1e40af';
      ctx.font = '15px Arial, sans-serif';
      ctx.fillText(dateText, canvasWidth / 2, 62);
    }

    // Trend period label
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText(`(${dateRange.period || 'Last 30 days'})`, canvasWidth / 2, 80);
    
    // Decorative line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, 90);
    ctx.lineTo(canvasWidth - padding, 90);
    ctx.stroke();
  }

  /**
   * Draw trend table
   */
  async drawTrendTable(ctx, trends, startY, canvasWidth, t = (key) => key) {
    const padding = 30;
    const tableWidth = canvasWidth - (padding * 2);
    const tableX = padding;
    
    // Column widths - Portrait layout (total must fit in 540px)
    const imageColWidth = 55;
    const nameColWidth = 135;
    const newPriceColWidth = 95;
    const changeColWidth = 88;
    const percentColWidth = 83;
    const trendColWidth = 84;
    
    const headerRowHeight = 70;
    const rowHeight = 85;
    
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
    
    // Headers - compact for portrait
    const headers = [
      { text: [t('commodity')], width: nameColWidth },
      { text: [t('new')], width: newPriceColWidth },
      { text: [t('change')], width: changeColWidth },
      { text: [t('percentageChange').split(' ')[0] || t('change')], width: percentColWidth },
      { text: ['↑↓'], width: trendColWidth }
    ];
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    for (const header of headers) {
      ctx.strokeRect(currentX, currentY, header.width, headerRowHeight);
      // Draw multi-line header text
      if (header.text.length === 1) {
        ctx.fillText(header.text[0], currentX + header.width / 2, currentY + headerRowHeight / 2 + 5);
      } else {
        ctx.fillText(header.text[0], currentX + header.width / 2, currentY + 28);
        ctx.fillText(header.text[1], currentX + header.width / 2, currentY + 48);
      }
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
  async drawTrendRow(ctx, trend, x, y, imageColWidth, nameColWidth, newPriceColWidth, changeColWidth, percentColWidth, trendColWidth, rowHeight, index) {
    // Alternating row colors
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    const totalWidth = imageColWidth + nameColWidth + newPriceColWidth + changeColWidth + percentColWidth + trendColWidth;
    ctx.fillRect(x, y, totalWidth, rowHeight);
    
    // Row borders
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    
    let currentX = x;
    
    // Image cell
    ctx.strokeRect(currentX, y, imageColWidth, rowHeight);
    
    // Draw commodity image
    const imageSize = 42;
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
    
    // Commodity name - compact with text wrapping
    ctx.strokeRect(currentX, y, nameColWidth, rowHeight);
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap commodity name if too long
    const commodityName = trend.commodity || 'N/A';
    const maxWidth = nameColWidth - 8;
    const words = commodityName.split(' ');
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
    
    const lineHeight = 15;
    const totalHeight = lines.length * lineHeight;
    let textY = y + (rowHeight - totalHeight) / 2 + 12;
    
    lines.forEach(line => {
      ctx.fillText(line, currentX + nameColWidth / 2, textY);
      textY += lineHeight;
    });
    currentX += nameColWidth;
    
    // Current price with date
    ctx.strokeRect(currentX, y, newPriceColWidth, rowHeight);
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 19px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(trend.currentPrice, currentX + newPriceColWidth / 2, y + rowHeight / 2 - 2);
    
    // Add date below current price
    if (trend.newestDate) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px Arial, sans-serif';
      const formattedDate = this.formatDateCompact(trend.newestDate);
      ctx.fillText(formattedDate, currentX + newPriceColWidth / 2, y + rowHeight / 2 + 14);
    }
    
    currentX += newPriceColWidth;
    
    // Price change with old date
    const changeColor = trend.priceChange >= 0 ? '#047857' : '#dc2626';
    const changePrefix = trend.priceChange >= 0 ? '+' : '';
    
    ctx.strokeRect(currentX, y, changeColWidth, rowHeight);
    ctx.fillStyle = changeColor;
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.fillText(`${changePrefix}${trend.priceChange}`, currentX + changeColWidth / 2, y + rowHeight / 2 - 2);
    
    // Add "from date" below change
    if (trend.oldestDate) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px Arial, sans-serif';
      const formattedDate = this.formatDateCompact(trend.oldestDate);
      ctx.fillText(`from ${formattedDate}`, currentX + changeColWidth / 2, y + rowHeight / 2 + 14);
    }
    
    currentX += changeColWidth;
    
    // Percent change
    ctx.strokeRect(currentX, y, percentColWidth, rowHeight);
    ctx.fillStyle = changeColor;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(`${changePrefix}${trend.percentChange}%`, currentX + percentColWidth / 2, y + rowHeight / 2 + 6);
    currentX += percentColWidth;
    
    // Trend indicator - compact arrow
    ctx.strokeRect(currentX, y, trendColWidth, rowHeight);
    
    const arrowX = currentX + trendColWidth / 2;
    const arrowY = y + rowHeight / 2;
    
    if (trend.direction === 'increasing') {
      // Up arrow
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY - 10);
      ctx.lineTo(arrowX - 10, arrowY + 5);
      ctx.lineTo(arrowX + 10, arrowY + 5);
      ctx.fill();
      ctx.fillStyle = '#047857';
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Rising', arrowX, arrowY + 20);
    } else if (trend.direction === 'decreasing') {
      // Down arrow
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 10);
      ctx.lineTo(arrowX - 10, arrowY - 5);
      ctx.lineTo(arrowX + 10, arrowY - 5);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Falling', arrowX, arrowY + 20);
    } else {
      // Flat line
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(arrowX - 12, arrowY - 2, 24, 4);
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Stable', arrowX, arrowY + 18);
    }
  }

  /**
   * Draw footer
   */
  drawFooter(ctx, y, canvasWidth, canvasHeight, pageNumber, totalPages) {
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, y, canvasWidth, canvasHeight - y);

    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    let footerText = 'AgriGuru - Price Trend Analysis';
    if (totalPages > 1) {
      footerText += ` (${pageNumber}/${totalPages})`;
    }
    
    ctx.fillText(footerText, canvasWidth / 2, y + 30);
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
   * Format date in compact form for small displays (e.g., "5 Jan")
   */
  formatDateCompact(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${date.getDate()} ${monthNames[date.getMonth()]}`;
    }
    
    return dateStr;
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
