/**
 * Test script for Master Tables and Spelling Correction Features
 * Tests all the scenarios mentioned in the requirements
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test scenarios for single commodity prices
const singleCommodityTests = [
  {
    name: 'Scenario 1: Correct market and commodity',
    query: 'Cotton price in Adoni',
    expected: {
      commodity: 'Cotton',
      market: 'Adoni',
      district: 'Kurnool',
      state: 'Andhra Pradesh'
    }
  },
  {
    name: 'Scenario 2: Incorrect market, correct commodity',
    query: 'cotton price in adni',
    expected: {
      commodity: 'Cotton',
      suggestions: ['Adoni'],
      shouldAskConfirmation: true
    }
  },
  {
    name: 'Scenario 3: Both incorrect',
    query: 'cooton price in adni',
    expected: {
      commoditySuggestions: ['Cotton'],
      marketSuggestions: ['Adoni'],
      shouldAskConfirmation: true
    }
  }
];

// Test scenarios for market-wide prices
const marketWideTests = [
  {
    name: 'Scenario 1: Misspelt market',
    query: 'kurnul market prices',
    expected: {
      suggestions: ['Kurnool'],
      shouldAskConfirmation: true
    }
  },
  {
    name: 'Scenario 2: Correct market, no data available',
    query: 'Holagunda market prices',
    expected: {
      nearbyMarketSuggestions: true,
      shouldShowNearest: true
    }
  },
  {
    name: 'Scenario 3: Multiple markets with same name',
    query: 'Krishna market prices',
    expected: {
      multipleOptions: true,
      shouldShowDistricts: true
    }
  },
  {
    name: 'Scenario 4: Non-existent market',
    query: 'xyzabc market prices',
    expected: {
      nearestMarketSuggestions: true,
      shouldShowNearest: true
    }
  }
];

// Test helper functions
async function testMarketValidation(marketName, state = null, district = null) {
  console.log(`\n${colors.cyan}Testing market validation for: ${marketName}${colors.reset}`);
  
  try {
    const params = { market: marketName };
    if (state) params.state = state;
    if (district) params.district = district;
    
    const response = await axios.get(`${BACKEND_URL}/api/master/markets/validate`, { params });
    
    if (response.data.exactMatch) {
      console.log(`${colors.green}✓ Exact match found:${colors.reset}`, response.data.market);
    } else if (response.data.suggestions.length > 0) {
      console.log(`${colors.yellow}⚠ No exact match. Suggestions:${colors.reset}`);
      response.data.suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.market} (${s.district}, ${s.state}) - ${(s.similarity * 100).toFixed(1)}% match`);
      });
    } else {
      console.log(`${colors.red}✗ No match or suggestions found${colors.reset}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return null;
  }
}

async function testCommodityValidation(commodityName) {
  console.log(`\n${colors.cyan}Testing commodity validation for: ${commodityName}${colors.reset}`);
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/master/commodities/validate`, {
      params: { commodity: commodityName }
    });
    
    if (response.data.exactMatch) {
      console.log(`${colors.green}✓ Exact match found:${colors.reset}`, response.data.commodity);
    } else if (response.data.suggestions.length > 0) {
      console.log(`${colors.yellow}⚠ No exact match. Suggestions:${colors.reset}`);
      response.data.suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.commodity_name} - ${(s.similarity * 100).toFixed(1)}% match`);
      });
    } else {
      console.log(`${colors.red}✗ No match or suggestions found${colors.reset}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return null;
  }
}

async function testNearbyMarkets(district, state) {
  console.log(`\n${colors.cyan}Testing nearby markets for: ${district}, ${state}${colors.reset}`);
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/master/markets/nearby`, {
      params: { district, state }
    });
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`${colors.green}✓ Found ${response.data.data.length} nearby markets:${colors.reset}`);
      response.data.data.slice(0, 5).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.market} (${m.district}, ${m.state})`);
      });
    } else {
      console.log(`${colors.red}✗ No nearby markets found${colors.reset}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return null;
  }
}

async function testFuzzySearch() {
  console.log(`\n${colors.blue}═══ FUZZY SEARCH TESTS ═══${colors.reset}`);
  
  // Test market fuzzy search
  console.log(`\n${colors.cyan}Testing fuzzy market search:${colors.reset}`);
  const marketTests = [
    { search: 'adni', expected: 'Adoni' },
    { search: 'kurnul', expected: 'Kurnool' },
    { search: 'bangalor', expected: 'Bangalore' },
    { search: 'hyderbad', expected: 'Hyderabad' }
  ];
  
  for (const test of marketTests) {
    const response = await axios.get(`${BACKEND_URL}/api/master/markets`, {
      params: { search: test.search, fuzzy: true, limit: 3 }
    });
    
    const found = response.data.data && response.data.data.length > 0;
    const topMatch = found ? response.data.data[0] : null;
    
    console.log(`  "${test.search}" → ${found ? `${colors.green}✓${colors.reset} ${topMatch.market}` : `${colors.red}✗ No match${colors.reset}`}`);
  }
  
  // Test commodity fuzzy search
  console.log(`\n${colors.cyan}Testing fuzzy commodity search:${colors.reset}`);
  const commodityTests = [
    { search: 'cooton', expected: 'Cotton' },
    { search: 'tomatoe', expected: 'Tomato' },
    { search: 'potatoe', expected: 'Potato' },
    { search: 'oniun', expected: 'Onion' }
  ];
  
  for (const test of commodityTests) {
    const response = await axios.get(`${BACKEND_URL}/api/master/commodities`, {
      params: { search: test.search, fuzzy: true, limit: 3 }
    });
    
    const found = response.data.data && response.data.data.length > 0;
    const topMatch = found ? response.data.data[0] : null;
    
    console.log(`  "${test.search}" → ${found ? `${colors.green}✓${colors.reset} ${topMatch.commodity_name}` : `${colors.red}✗ No match${colors.reset}`}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   MASTER TABLES & FUZZY SEARCH TESTS  ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}`);
  
  // Test server connectivity
  console.log(`\n${colors.cyan}Testing server connectivity...${colors.reset}`);
  try {
    await axios.get(`${BACKEND_URL}/health`);
    console.log(`${colors.green}✓ Backend server is running${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Backend server is not running. Start it with: npm run server${colors.reset}`);
    return;
  }
  
  // Run fuzzy search tests
  await testFuzzySearch();
  
  // Test single commodity scenarios
  console.log(`\n${colors.blue}═══ SINGLE COMMODITY SCENARIOS ═══${colors.reset}`);
  
  await testMarketValidation('Adoni', 'Andhra Pradesh', 'Kurnool');
  await testMarketValidation('adni'); // Misspelled
  await testCommodityValidation('Cotton');
  await testCommodityValidation('cooton'); // Misspelled
  
  // Test market-wide scenarios
  console.log(`\n${colors.blue}═══ MARKET-WIDE SCENARIOS ═══${colors.reset}`);
  
  await testMarketValidation('kurnul'); // Misspelled
  await testMarketValidation('Holagunda'); // Small town
  await testMarketValidation('Krishna'); // Multiple markets
  await testMarketValidation('xyzabc'); // Non-existent
  
  // Test nearby markets
  console.log(`\n${colors.blue}═══ NEARBY MARKETS TESTS ═══${colors.reset}`);
  
  await testNearbyMarkets('Kurnool', 'Andhra Pradesh');
  await testNearbyMarkets('Bangalore Urban', 'Karnataka');
  
  console.log(`\n${colors.blue}═══ ALL TESTS COMPLETED ═══${colors.reset}\n`);
}

// Run tests
runAllTests().catch(console.error);
