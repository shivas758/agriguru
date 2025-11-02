// Check Available Gemini Models
// Run this with: node check-available-models.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read .env file manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let API_KEY = process.env.VITE_GEMINI_API_KEY;

// Try to read from .env file if not in environment
if (!API_KEY) {
  try {
    const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) {
      API_KEY = match[1].trim();
    }
  } catch (error) {
    // .env file not found
  }
}

if (!API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🔍 Checking available Gemini models...\n');
console.log('API Key:', API_KEY.substring(0, 10) + '...\n');

// Try to list models via API
async function listModels() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      console.log('✅ Available Models:\n');
      console.log('=' .repeat(80));
      
      // Filter for vision-capable models
      const visionModels = data.models.filter(model => 
        model.supportedGenerationMethods?.includes('generateContent') &&
        (model.name.includes('vision') || 
         model.name.includes('1.5') || 
         model.name.includes('2.0') ||
         model.name.includes('2.5'))
      );
      
      console.log('\n📸 VISION-CAPABLE MODELS (for image analysis):\n');
      visionModels.forEach(model => {
        const modelName = model.name.replace('models/', '');
        console.log(`✨ ${modelName}`);
        console.log(`   Full name: ${model.name}`);
        console.log(`   Display name: ${model.displayName}`);
        console.log(`   Supports: ${model.supportedGenerationMethods?.join(', ')}`);
        console.log(`   Input token limit: ${model.inputTokenLimit || 'N/A'}`);
        console.log(`   Output token limit: ${model.outputTokenLimit || 'N/A'}`);
        console.log('');
      });
      
      console.log('\n📝 ALL MODELS:\n');
      data.models.forEach(model => {
        const modelName = model.name.replace('models/', '');
        console.log(`• ${modelName}`);
        console.log(`  Methods: ${model.supportedGenerationMethods?.join(', ')}`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('\n💡 RECOMMENDED MODEL FOR YOUR UPLOAD PAGE:');
      if (visionModels.length > 0) {
        const recommended = visionModels[0].name.replace('models/', '');
        console.log(`\n   Use this model: "${recommended}"\n`);
        console.log('   Or try without "models/" prefix if that doesn\'t work.');
      } else {
        console.log('\n   ⚠️ No vision models found!');
      }
      
    } else {
      console.log('⚠️ No models returned from API');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error fetching models:', error.message);
    console.error('\nFull error:', error);
  }
}

// Test models directly
async function testModels() {
  console.log('\n\n🧪 Testing Models Directly...\n');
  console.log('='.repeat(80));
  
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const modelsToTest = [
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro-001',
    'gemini-pro-vision',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro',
    'models/gemini-pro-vision',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
  ];
  
  for (const modelName of modelsToTest) {
    try {
      process.stdout.write(`Testing ${modelName}... `);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Try a simple text generation
      const result = await model.generateContent(['Say "OK"']);
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ WORKS! (Response: ${text.trim()})`);
      
    } catch (error) {
      if (error.message.includes('404')) {
        console.log(`❌ Not found`);
      } else if (error.message.includes('403')) {
        console.log(`❌ Forbidden (check permissions)`);
      } else {
        console.log(`❌ Error: ${error.message.substring(0, 50)}...`);
      }
    }
  }
}

// Run both checks
async function main() {
  await listModels();
  await testModels();
  
  console.log('\n\n✅ Check complete!');
  console.log('\nℹ️  Copy the WORKING model name from above and provide it to me.');
}

main();
