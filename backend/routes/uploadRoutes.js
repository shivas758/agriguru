import express from 'express';
import supabase, { insertMarketPrices } from '../services/supabaseClient.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/upload/manual
 * Upload manual market price data
 */
router.post('/manual', async (req, res) => {
  try {
    const data = req.body;
    
    // Validate required fields
    const requiredFields = ['commodity', 'state', 'district', 'market', 'arrival_date', 'modal_price'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Prepare record for database
    const record = {
      commodity: data.commodity,
      variety: data.variety || 'Unknown',
      state: data.state,
      district: data.district,
      market: data.market,
      arrival_date: data.arrival_date,
      min_price: parseFloat(data.min_price) || null,
      max_price: parseFloat(data.max_price) || null,
      modal_price: parseFloat(data.modal_price),
      arrival_quantity: parseFloat(data.arrival_quantity) || null,
      grade: data.grade || null,
      data_source: data.data_source || 'manual_entry',
      uploaded_by: data.uploaded_by || 'feeder',
      uploaded_at: new Date().toISOString()
    };
    
    logger.info('Manual upload request:', { record });
    
    // Upsert to database (overwrites existing data)
    const { error } = await supabase
      .from('market_prices')
      .upsert([record], {
        onConflict: 'arrival_date,state,district,market,commodity,variety'
      });
    
    if (error) {
      logger.error('Manual upload failed:', error);
      throw error;
    }
    
    logger.info('Manual upload successful');
    
    res.json({
      success: true,
      message: 'Data uploaded successfully',
      record
    });
    
  } catch (error) {
    logger.error('Error in manual upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload/batch
 * Upload batch of market price data (for OCR)
 */
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Records array is required and must not be empty'
      });
    }
    
    // Validate each record
    const validRecords = [];
    const errors = [];
    
    for (let i = 0; i < records.length; i++) {
      const data = records[i];
      const requiredFields = ['commodity', 'state', 'district', 'market', 'arrival_date', 'modal_price'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        errors.push(`Record ${i + 1}: Missing fields - ${missingFields.join(', ')}`);
        continue;
      }
      
      validRecords.push({
        commodity: data.commodity,
        variety: data.variety || 'Unknown',
        state: data.state,
        district: data.district,
        market: data.market,
        arrival_date: data.arrival_date,
        min_price: parseFloat(data.min_price) || null,
        max_price: parseFloat(data.max_price) || null,
        modal_price: parseFloat(data.modal_price) || 0,
        arrival_quantity: parseFloat(data.arrival_quantity) || null,
        grade: data.grade || null,
        data_source: data.data_source || 'ocr_upload',
        uploaded_by: data.uploaded_by || 'feeder',
        uploaded_at: new Date().toISOString()
      });
    }
    
    if (validRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid records to upload',
        errors
      });
    }
    
    logger.info(`Batch upload request: ${validRecords.length} records`);
    
    // Upsert to database
    const { error } = await supabase
      .from('market_prices')
      .upsert(validRecords, {
        onConflict: 'arrival_date,state,district,market,commodity,variety'
      });
    
    if (error) {
      logger.error('Batch upload failed:', error);
      throw error;
    }
    
    logger.info(`Batch upload successful: ${validRecords.length} records`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${validRecords.length} record(s)`,
      uploaded: validRecords.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    logger.error('Error in batch upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/upload/recent
 * Get recent uploads by feeders
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const { data, error } = await supabase
      .from('market_prices')
      .select('*')
      .in('data_source', ['manual_entry', 'ocr_upload', 'ai_upload'])
      .order('uploaded_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
    
  } catch (error) {
    logger.error('Error getting recent uploads:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/upload/:id
 * Delete a manual/OCR upload entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('market_prices')
      .delete()
      .eq('id', id)
      .in('data_source', ['manual_entry', 'ocr_upload', 'ai_upload']);
    
    if (error) throw error;
    
    logger.info(`Deleted upload entry: ${id}`);
    
    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
