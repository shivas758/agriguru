import { supabase } from '../services/supabaseClient.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Populate master tables with initial data
 */
async function populateMasterTables() {
  try {
    logger.info('Starting master tables population...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/populate_master_tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by major sections (each step)
    const sections = sqlContent.split(/-- ============================================================================/);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const section of sections) {
      if (section.trim().length === 0) continue;
      
      // Extract section name
      const sectionMatch = section.match(/-- (STEP \d+:.+)/);
      const sectionName = sectionMatch ? sectionMatch[1] : 'Unknown section';
      
      // Skip sections that are just comments or verification queries
      if (section.includes('Verify data was inserted')) {
        continue;
      }
      
      // Extract SQL statements (remove comments and empty lines)
      const statements = section
        .split(';')
        .filter(stmt => {
          const trimmed = stmt.trim();
          return trimmed.length > 0 && 
                 !trimmed.startsWith('--') && 
                 !trimmed.startsWith('SELECT \'');
        })
        .map(stmt => stmt.trim() + ';');
      
      for (const statement of statements) {
        if (!statement || statement === ';') continue;
        
        try {
          // For INSERT statements, we need to handle them differently
          if (statement.includes('INSERT INTO commodities_master')) {
            logger.info('Populating commodities_master table...');
            // Execute as raw SQL
            const { error } = await supabase.rpc('exec_sql', {
              query: statement
            }).catch(async () => {
              // If RPC doesn't exist, try direct insertion
              logger.info('Using direct insertion for commodities...');
              return { error: 'Use direct method' };
            });
            
            if (error === 'Use direct method') {
              // Parse and insert directly
              await insertCommoditiesDirectly();
            } else if (error) {
              throw error;
            }
            successCount++;
          } else if (statement.includes('INSERT INTO markets_master')) {
            logger.info('Populating markets_master table...');
            // Execute as raw SQL
            const { error } = await supabase.rpc('exec_sql', {
              query: statement
            }).catch(async () => {
              // If RPC doesn't exist, try direct insertion
              logger.info('Using direct insertion for markets...');
              return { error: 'Use direct method' };
            });
            
            if (error === 'Use direct method') {
              // Parse and insert directly
              await insertMarketsDirectly();
            } else if (error) {
              throw error;
            }
            successCount++;
          } else if (statement.includes('CREATE')) {
            // Skip CREATE statements for now (these should be in main migration)
            logger.info(`Skipping: ${statement.substring(0, 50)}...`);
          }
        } catch (error) {
          logger.error(`Error executing statement in ${sectionName}:`, error);
          logger.error(`Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }
    
    // Verify the data was inserted
    const { data: commodities, error: commodityError } = await supabase
      .from('commodities_master')
      .select('count', { count: 'exact' });
    
    const { data: markets, error: marketError } = await supabase
      .from('markets_master')
      .select('count', { count: 'exact' });
    
    if (!commodityError && !marketError) {
      logger.info('✅ Master tables populated successfully!');
      logger.info(`   Commodities: ${commodities ? commodities.length : 0} records`);
      logger.info(`   Markets: ${markets ? markets.length : 0} records`);
    }
    
    logger.info(`Population complete: ${successCount} successful, ${errorCount} errors`);
  } catch (error) {
    logger.error('Failed to populate master tables:', error);
    process.exit(1);
  }
}

/**
 * Direct insertion of commodities
 */
async function insertCommoditiesDirectly() {
  const commodities = [
    // Vegetables
    { commodity_name: 'Tomato', category: 'Vegetables', is_popular: true, query_count: 100 },
    { commodity_name: 'Onion', category: 'Vegetables', is_popular: true, query_count: 95 },
    { commodity_name: 'Potato', category: 'Vegetables', is_popular: true, query_count: 90 },
    { commodity_name: 'Brinjal', category: 'Vegetables', is_popular: false, query_count: 30 },
    { commodity_name: 'Cabbage', category: 'Vegetables', is_popular: false, query_count: 25 },
    { commodity_name: 'Cauliflower', category: 'Vegetables', is_popular: false, query_count: 20 },
    { commodity_name: 'Carrot', category: 'Vegetables', is_popular: false, query_count: 15 },
    { commodity_name: 'Beans', category: 'Vegetables', is_popular: false, query_count: 10 },
    { commodity_name: 'Capsicum', category: 'Vegetables', is_popular: false, query_count: 8 },
    { commodity_name: 'Cucumber', category: 'Vegetables', is_popular: false, query_count: 12 },
    { commodity_name: 'Lady Finger', category: 'Vegetables', is_popular: false, query_count: 13 },
    { commodity_name: 'Green Chilli', category: 'Vegetables', is_popular: true, query_count: 40 },
    { commodity_name: 'Garlic', category: 'Vegetables', is_popular: true, query_count: 35 },
    { commodity_name: 'Ginger', category: 'Vegetables', is_popular: true, query_count: 30 },
    
    // Fruits
    { commodity_name: 'Banana', category: 'Fruits', is_popular: true, query_count: 50 },
    { commodity_name: 'Apple', category: 'Fruits', is_popular: true, query_count: 45 },
    { commodity_name: 'Mango', category: 'Fruits', is_popular: true, query_count: 60 },
    { commodity_name: 'Grapes', category: 'Fruits', is_popular: false, query_count: 25 },
    { commodity_name: 'Orange', category: 'Fruits', is_popular: false, query_count: 30 },
    { commodity_name: 'Pomegranate', category: 'Fruits', is_popular: false, query_count: 20 },
    { commodity_name: 'Guava', category: 'Fruits', is_popular: false, query_count: 15 },
    { commodity_name: 'Papaya', category: 'Fruits', is_popular: false, query_count: 10 },
    { commodity_name: 'Watermelon', category: 'Fruits', is_popular: false, query_count: 18 },
    
    // Cereals & Grains
    { commodity_name: 'Rice', category: 'Cereals', is_popular: true, query_count: 85 },
    { commodity_name: 'Wheat', category: 'Cereals', is_popular: true, query_count: 80 },
    { commodity_name: 'Maize', category: 'Cereals', is_popular: true, query_count: 40 },
    { commodity_name: 'Barley', category: 'Cereals', is_popular: false, query_count: 10 },
    { commodity_name: 'Jowar', category: 'Cereals', is_popular: false, query_count: 15 },
    { commodity_name: 'Bajra', category: 'Cereals', is_popular: false, query_count: 12 },
    { commodity_name: 'Ragi', category: 'Cereals', is_popular: false, query_count: 8 },
    
    // Pulses
    { commodity_name: 'Tur', category: 'Pulses', is_popular: true, query_count: 35 },
    { commodity_name: 'Arhar', category: 'Pulses', is_popular: true, query_count: 35 },
    { commodity_name: 'Urad', category: 'Pulses', is_popular: true, query_count: 30 },
    { commodity_name: 'Moong', category: 'Pulses', is_popular: true, query_count: 28 },
    { commodity_name: 'Masoor', category: 'Pulses', is_popular: false, query_count: 20 },
    { commodity_name: 'Gram', category: 'Pulses', is_popular: true, query_count: 25 },
    { commodity_name: 'Chana', category: 'Pulses', is_popular: true, query_count: 25 },
    
    // Oilseeds
    { commodity_name: 'Groundnut', category: 'Oilseeds', is_popular: true, query_count: 40 },
    { commodity_name: 'Mustard', category: 'Oilseeds', is_popular: true, query_count: 30 },
    { commodity_name: 'Sunflower', category: 'Oilseeds', is_popular: false, query_count: 20 },
    { commodity_name: 'Soyabean', category: 'Oilseeds', is_popular: true, query_count: 35 },
    { commodity_name: 'Sesame', category: 'Oilseeds', is_popular: false, query_count: 10 },
    { commodity_name: 'Copra', category: 'Oilseeds', is_popular: false, query_count: 12 },
    
    // Spices
    { commodity_name: 'Turmeric', category: 'Spices', is_popular: true, query_count: 25 },
    { commodity_name: 'Red Chilli', category: 'Spices', is_popular: true, query_count: 30 },
    { commodity_name: 'Black Pepper', category: 'Spices', is_popular: false, query_count: 15 },
    { commodity_name: 'Coriander', category: 'Spices', is_popular: false, query_count: 10 },
    { commodity_name: 'Cumin', category: 'Spices', is_popular: false, query_count: 8 },
    
    // Cash Crops
    { commodity_name: 'Cotton', category: 'Cash Crops', is_popular: true, query_count: 70 },
    { commodity_name: 'Sugarcane', category: 'Cash Crops', is_popular: true, query_count: 60 },
    { commodity_name: 'Jute', category: 'Cash Crops', is_popular: false, query_count: 20 },
    { commodity_name: 'Tobacco', category: 'Cash Crops', is_popular: false, query_count: 15 },
    { commodity_name: 'Tea', category: 'Cash Crops', is_popular: false, query_count: 10 },
    { commodity_name: 'Coffee', category: 'Cash Crops', is_popular: false, query_count: 12 },
    { commodity_name: 'Rubber', category: 'Cash Crops', is_popular: false, query_count: 8 }
  ];
  
  const { error } = await supabase
    .from('commodities_master')
    .upsert(commodities, { 
      onConflict: 'commodity_name',
      ignoreDuplicates: false 
    });
  
  if (error) {
    logger.error('Error inserting commodities:', error);
    throw error;
  }
  
  logger.info(`✓ Inserted ${commodities.length} commodities`);
}

/**
 * Direct insertion of markets
 */
async function insertMarketsDirectly() {
  const markets = [
    // Andhra Pradesh Markets
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Adoni', is_active: true, query_count: 50 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Kurnool', is_active: true, query_count: 60 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Nandyal', is_active: true, query_count: 30 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Alur', is_active: true, query_count: 15 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Dhone', is_active: true, query_count: 10 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Yemmiganur', is_active: true, query_count: 12 },
    { state: 'Andhra Pradesh', district: 'Kurnool', market: 'Pattikonda', is_active: true, query_count: 8 },
    { state: 'Andhra Pradesh', district: 'Guntur', market: 'Guntur', is_active: true, query_count: 70 },
    { state: 'Andhra Pradesh', district: 'Guntur', market: 'Tenali', is_active: true, query_count: 35 },
    { state: 'Andhra Pradesh', district: 'Krishna', market: 'Vijayawada', is_active: true, query_count: 80 },
    { state: 'Andhra Pradesh', district: 'Krishna', market: 'Machilipatnam', is_active: true, query_count: 30 },
    { state: 'Andhra Pradesh', district: 'East Godavari', market: 'Kakinada', is_active: true, query_count: 60 },
    { state: 'Andhra Pradesh', district: 'East Godavari', market: 'Rajahmundry', is_active: true, query_count: 55 },
    { state: 'Andhra Pradesh', district: 'West Godavari', market: 'Eluru', is_active: true, query_count: 45 },
    { state: 'Andhra Pradesh', district: 'Visakhapatnam', market: 'Visakhapatnam', is_active: true, query_count: 75 },
    { state: 'Andhra Pradesh', district: 'Chittoor', market: 'Tirupati', is_active: true, query_count: 50 },
    { state: 'Andhra Pradesh', district: 'Anantapur', market: 'Anantapur', is_active: true, query_count: 45 },
    
    // Telangana Markets
    { state: 'Telangana', district: 'Hyderabad', market: 'Hyderabad', is_active: true, query_count: 100 },
    { state: 'Telangana', district: 'Hyderabad', market: 'Bowenpally', is_active: true, query_count: 40 },
    { state: 'Telangana', district: 'Warangal', market: 'Warangal', is_active: true, query_count: 50 },
    { state: 'Telangana', district: 'Karimnagar', market: 'Karimnagar', is_active: true, query_count: 40 },
    { state: 'Telangana', district: 'Nizamabad', market: 'Nizamabad', is_active: true, query_count: 35 },
    { state: 'Telangana', district: 'Khammam', market: 'Khammam', is_active: true, query_count: 30 },
    
    // Karnataka Markets
    { state: 'Karnataka', district: 'Bangalore Urban', market: 'Bangalore', is_active: true, query_count: 90 },
    { state: 'Karnataka', district: 'Bangalore Urban', market: 'K.R. Market', is_active: true, query_count: 50 },
    { state: 'Karnataka', district: 'Mysore', market: 'Mysore', is_active: true, query_count: 60 },
    { state: 'Karnataka', district: 'Belgaum', market: 'Belgaum', is_active: true, query_count: 40 },
    { state: 'Karnataka', district: 'Hubli-Dharwad', market: 'Hubli', is_active: true, query_count: 45 },
    { state: 'Karnataka', district: 'Mangalore', market: 'Mangalore', is_active: true, query_count: 35 },
    { state: 'Karnataka', district: 'Bellary', market: 'Bellary', is_active: true, query_count: 25 },
    
    // Tamil Nadu Markets
    { state: 'Tamil Nadu', district: 'Chennai', market: 'Chennai', is_active: true, query_count: 85 },
    { state: 'Tamil Nadu', district: 'Chennai', market: 'Koyambedu', is_active: true, query_count: 60 },
    { state: 'Tamil Nadu', district: 'Coimbatore', market: 'Coimbatore', is_active: true, query_count: 55 },
    { state: 'Tamil Nadu', district: 'Madurai', market: 'Madurai', is_active: true, query_count: 45 },
    { state: 'Tamil Nadu', district: 'Trichy', market: 'Trichy', is_active: true, query_count: 35 },
    { state: 'Tamil Nadu', district: 'Salem', market: 'Salem', is_active: true, query_count: 30 },
    
    // Maharashtra Markets
    { state: 'Maharashtra', district: 'Mumbai', market: 'Mumbai', is_active: true, query_count: 95 },
    { state: 'Maharashtra', district: 'Mumbai', market: 'Vashi', is_active: true, query_count: 50 },
    { state: 'Maharashtra', district: 'Pune', market: 'Pune', is_active: true, query_count: 70 },
    { state: 'Maharashtra', district: 'Nagpur', market: 'Nagpur', is_active: true, query_count: 45 },
    { state: 'Maharashtra', district: 'Nashik', market: 'Nashik', is_active: true, query_count: 40 },
    { state: 'Maharashtra', district: 'Aurangabad', market: 'Aurangabad', is_active: true, query_count: 35 },
    { state: 'Maharashtra', district: 'Amravati', market: 'Amravati', is_active: true, query_count: 25 },
    
    // Other Major Markets
    { state: 'Delhi', district: 'Delhi', market: 'Azadpur', is_active: true, query_count: 80 },
    { state: 'Uttar Pradesh', district: 'Lucknow', market: 'Lucknow', is_active: true, query_count: 50 },
    { state: 'Gujarat', district: 'Ahmedabad', market: 'Ahmedabad', is_active: true, query_count: 60 },
    { state: 'Rajasthan', district: 'Jaipur', market: 'Jaipur', is_active: true, query_count: 45 },
    { state: 'West Bengal', district: 'Kolkata', market: 'Kolkata', is_active: true, query_count: 70 },
    { state: 'Bihar', district: 'Patna', market: 'Patna', is_active: true, query_count: 40 },
    { state: 'Madhya Pradesh', district: 'Indore', market: 'Indore', is_active: true, query_count: 45 },
    { state: 'Odisha', district: 'Bhubaneswar', market: 'Bhubaneswar', is_active: true, query_count: 35 },
    { state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana', is_active: true, query_count: 40 },
    { state: 'Haryana', district: 'Gurgaon', market: 'Gurgaon', is_active: true, query_count: 35 },
    { state: 'Kerala', district: 'Kochi', market: 'Kochi', is_active: true, query_count: 35 }
  ];
  
  const { error } = await supabase
    .from('markets_master')
    .upsert(markets, { 
      onConflict: 'state,district,market',
      ignoreDuplicates: false 
    });
  
  if (error) {
    logger.error('Error inserting markets:', error);
    throw error;
  }
  
  logger.info(`✓ Inserted ${markets.length} markets`);
}

// Run the population script
populateMasterTables();
