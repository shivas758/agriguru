// AgriGuru Modern Upload Module with Gemini AI
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize Gemini with vision-capable model
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Models to try in order of preference (updated for Gemini 2.0+)
const MODELS_TO_TRY = [
  'gemini-2.5-flash',              // ✅ Latest, fastest with vision (CONFIRMED WORKING)
  'gemini-2.0-flash',              // ✅ Stable 2.0 with vision (CONFIRMED WORKING)
  'gemini-2.5-pro',                // Pro version with better accuracy
  'gemini-2.0-flash-exp',          // Experimental 2.0
  'gemini-2.5-pro-preview-03-25',  // Preview with vision support
  'gemini-flash-latest',           // Generic latest flash
];

// Get vision model instance
function getVisionModelInstance(modelName) {
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  });
}

// Tab switching
const manualTab = document.getElementById('manualTab');
const imageTab = document.getElementById('imageTab');
const manualForm = document.getElementById('manualForm');
const imageForm = document.getElementById('imageForm');

manualTab.addEventListener('click', () => {
  manualTab.classList.remove('bg-white', 'text-gray-600');
  manualTab.classList.add('gradient-btn', 'text-white', 'shine');
  imageTab.classList.remove('gradient-btn', 'text-white', 'shine');
  imageTab.classList.add('bg-white', 'text-gray-600');
  manualForm.classList.remove('hidden');
  imageForm.classList.add('hidden');
});

imageTab.addEventListener('click', () => {
  imageTab.classList.remove('bg-white', 'text-gray-600');
  imageTab.classList.add('gradient-btn', 'text-white', 'shine');
  manualTab.classList.remove('gradient-btn', 'text-white', 'shine');
  manualTab.classList.add('bg-white', 'text-gray-600');
  imageForm.classList.remove('hidden');
  manualForm.classList.add('hidden');
});

// Manual Data Entry
const dataEntryForm = document.getElementById('dataEntryForm');
const manualStatus = document.getElementById('manualStatus');

dataEntryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(dataEntryForm);
  const data = {
    commodity: formData.get('commodity'),
    variety: formData.get('variety') || 'Unknown',
    state: formData.get('state'),
    district: formData.get('district'),
    market: formData.get('market'),
    arrival_date: formData.get('arrival_date'),
    min_price: parseFloat(formData.get('min_price')),
    max_price: parseFloat(formData.get('max_price')),
    modal_price: parseFloat(formData.get('modal_price')),
    arrival_quantity: parseFloat(formData.get('arrival_quantity')) || null,
    grade: formData.get('grade') || null,
    data_source: 'manual_entry',
    uploaded_by: 'feeder',
    uploaded_at: new Date().toISOString()
  };
  
  try {
    showStatus(manualStatus, '⏳ Uploading data...', 'info');
    
    const response = await fetch(`${BACKEND_URL}/api/upload/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!response.ok) throw new Error(result.error || 'Upload failed');
    
    showStatus(manualStatus, '✅ Data uploaded successfully! Existing data has been updated.', 'success');
    dataEntryForm.reset();
    loadRecentUploads();
    
  } catch (error) {
    console.error('Upload error:', error);
    showStatus(manualStatus, `❌ Error: ${error.message}`, 'error');
  }
});

// AI Image Upload
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const extractedData = document.getElementById('extractedData');
const processAI = document.getElementById('processAI');
const cancelAI = document.getElementById('cancelAI');
const aiStatus = document.getElementById('aiStatus');

let extractedRecords = [];

uploadArea.addEventListener('click', () => imageInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleImageUpload(file);
  }
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleImageUpload(file);
});

async function handleImageUpload(file) {
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    imagePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
  
  // Check if Gemini API key is available
  if (!GEMINI_API_KEY) {
    extractedData.innerHTML = `
      <div class="text-center py-8">
        <div class="text-5xl mb-3">⚠️</div>
        <p class="text-red-600 font-medium">Gemini API key not configured</p>
        <p class="text-gray-500 text-sm mt-2">Please add VITE_GEMINI_API_KEY to your .env file</p>
      </div>
    `;
    return;
  }
  
  // Extract data with Gemini AI
  try {
    extractedData.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-5xl mb-4 animate-pulse">🧠</div>
        <p class="text-gray-600 font-medium">AI is analyzing your image...</p>
        <p class="text-gray-500 text-sm mt-2">This works with Hindi, Telugu, Tamil, Kannada & more!</p>
      </div>
    `;
    
    // Convert file to base64 for Gemini
    const base64Data = await fileToBase64(file);
    
    const prompt = `
You are an AI assistant that extracts market price data from images. The image may contain text in English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Bengali, or other Indian languages.

Extract ALL market price records from this image and return them as a JSON array. Each record should have:

{
  "commodity": "crop/commodity name in English",
  "variety": "variety if mentioned, else null",
  "state": "state name if mentioned, else null",
  "district": "district name if mentioned, else null",
  "market": "market/mandi name if mentioned, else null",
  "arrival_date": "date in YYYY-MM-DD format if mentioned, else today's date",
  "min_price": number (price in rupees per quintal),
  "max_price": number (price in rupees per quintal),
  "modal_price": number (most common price in rupees per quintal),
  "arrival_quantity": number (quantity in quintals, null if not mentioned),
  "grade": "grade if mentioned, else null"
}

IMPORTANT INSTRUCTIONS:
1. If the image contains text in an Indian language, translate commodity names to English
2. Extract ALL visible records, not just one
3. If a field is not visible in the image, set it to null
4. For dates, use YYYY-MM-DD format
5. Prices should be numbers without ₹ symbol or commas
6. If you see a table, extract all rows
7. Common Indian language commodity names to translate:
   - गेहूं/ಗೋಧಿ/గోధుమ = Wheat
   - धान/ಭತ್ತ/వరి = Paddy/Rice
   - प्याज/ಈರುಳ್ಳಿ/ఉల్లిపాయ = Onion
   - टमाटर/ಟೊಮೇಟೊ/టమాటా = Tomato
   - आलू/ಆಲೂಗಡ್ಡೆ/బంగాళదుంప = Potato
   - मक्का/ಮೆಕ್ಕೆಜೋಳ/మొక్కజొన్న = Maize

Return ONLY a valid JSON array, nothing else. If you cannot extract any data, return an empty array [].

Example output:
[
  {
    "commodity": "Wheat",
    "variety": "PBW-343",
    "state": "Punjab",
    "district": "Ludhiana",
    "market": "Khanna Mandi",
    "arrival_date": "2025-11-01",
    "min_price": 1800,
    "max_price": 2200,
    "modal_price": 2000,
    "arrival_quantity": 500,
    "grade": "FAQ"
  }
]
`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type
      }
    };

    // Try each model until one works
    let text = null;
    let workingModel = null;
    
    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`🔍 Trying model: ${modelName}...`);
        const model = getVisionModelInstance(modelName);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        text = response.text();
        workingModel = modelName;
        console.log(`✅ Model ${modelName} worked!`);
        console.log('Gemini AI Response:', text);
        break; // Success! Stop trying other models
      } catch (error) {
        console.warn(`❌ Model ${modelName} failed:`, error.message);
        // Continue to next model
      }
    }
    
    if (!text) {
      throw new Error('All vision models failed. Please check your API key and quota.');
    }
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      extractedRecords = JSON.parse(jsonMatch[0]);
      
      if (extractedRecords.length === 0) {
        extractedData.innerHTML = `
          <div class="text-center py-8">
            <div class="text-5xl mb-3">😕</div>
            <p class="text-gray-600 font-medium">Could not extract data from image</p>
            <p class="text-gray-500 text-sm mt-2">Please ensure the image contains clear market price information</p>
          </div>
        `;
        return;
      }
      
      // Display extracted data
      extractedData.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-gray-700">✨ ${extractedRecords.length} record(s) extracted</span>
          </div>
          ${extractedRecords.map((record, index) => `
            <div class="bg-white p-3 rounded-lg border-2 border-purple-100 hover:border-purple-300 transition-all">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-semibold text-gray-800">${record.commodity || 'Unknown'}</div>
                  <div class="text-xs text-gray-600 mt-1">
                    ${record.market || 'Market N/A'} • ${record.district || 'District N/A'}<br>
                    ₹${record.modal_price || 'N/A'} (Min: ${record.min_price || 'N/A'}, Max: ${record.max_price || 'N/A'})
                  </div>
                </div>
                <button onclick="removeRecord(${index})" class="text-red-500 hover:text-red-700 ml-2">❌</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
    } else {
      throw new Error('Could not parse AI response');
    }
    
  } catch (error) {
    console.error('AI extraction error:', error);
    extractedData.innerHTML = `
      <div class="text-center py-8">
        <div class="text-5xl mb-3">⚠️</div>
        <p class="text-red-600 font-medium">Error processing image</p>
        <p class="text-gray-500 text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

// Make removeRecord global
window.removeRecord = (index) => {
  extractedRecords.splice(index, 1);
  if (extractedRecords.length === 0) {
    extractedData.innerHTML = '<p class="text-gray-500 text-center py-8">No records to upload</p>';
  } else {
    // Re-render
    handleImageUpload = null; // Trigger re-render with current records
  }
};

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

cancelAI.addEventListener('click', () => {
  imagePreview.classList.add('hidden');
  imageInput.value = '';
  extractedRecords = [];
});

processAI.addEventListener('click', async () => {
  if (extractedRecords.length === 0) {
    showStatus(aiStatus, '⚠️ No data to upload', 'error');
    return;
  }
  
  try {
    showStatus(aiStatus, '⏳ Uploading extracted data...', 'info');
    
    // Add metadata to records
    const recordsWithMeta = extractedRecords.map(record => ({
      ...record,
      data_source: 'ai_upload',
      uploaded_by: 'feeder',
      uploaded_at: new Date().toISOString(),
      // Set default values if missing
      commodity: record.commodity || 'Unknown',
      variety: record.variety || 'Unknown',
      arrival_date: record.arrival_date || new Date().toISOString().split('T')[0],
      min_price: parseFloat(record.min_price) || null,
      max_price: parseFloat(record.max_price) || null,
      modal_price: parseFloat(record.modal_price) || 0
    }));
    
    const response = await fetch(`${BACKEND_URL}/api/upload/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: recordsWithMeta })
    });
    
    const result = await response.json();
    
    if (!response.ok) throw new Error(result.error || 'Upload failed');
    
    showStatus(aiStatus, `✅ Successfully uploaded ${result.uploaded} record(s)!`, 'success');
    imagePreview.classList.add('hidden');
    imageInput.value = '';
    extractedRecords = [];
    loadRecentUploads();
    
  } catch (error) {
    console.error('Upload error:', error);
    showStatus(aiStatus, `❌ Error: ${error.message}`, 'error');
  }
});

// Load recent uploads
async function loadRecentUploads() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/upload/recent?limit=10`);
    const result = await response.json();
    
    if (!response.ok) throw new Error(result.error || 'Failed to load uploads');
    
    const recentUploads = document.getElementById('recentUploads');
    
    if (!result.data || result.data.length === 0) {
      recentUploads.innerHTML = '<p class="text-gray-500 text-center py-12">No recent uploads</p>';
      return;
    }
    
    recentUploads.innerHTML = result.data.map(record => `
      <div class="glass rounded-xl p-4 hover:shadow-lg transition-all border-l-4 border-purple-500">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="font-semibold text-gray-800 flex items-center space-x-2">
              <span>${record.commodity} - ${record.market}</span>
              <span class="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">${record.data_source === 'manual_entry' ? '⌨️ Manual' : record.data_source === 'ai_upload' ? '🤖 AI' : '📸 OCR'}</span>
            </div>
            <div class="text-sm text-gray-600 mt-1">
              📍 ${record.state}, ${record.district} • 
              💰 ₹${record.modal_price}/Quintal • 
              📅 ${record.arrival_date}
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading recent uploads:', error);
  }
}

// Utility function to show status messages
function showStatus(element, message, type) {
  const bgColor = {
    success: 'bg-green-50 border-l-4 border-green-500 text-green-800',
    error: 'bg-red-50 border-l-4 border-red-500 text-red-800',
    info: 'bg-blue-50 border-l-4 border-blue-500 text-blue-800'
  }[type] || 'bg-gray-50 border-l-4 border-gray-500 text-gray-800';
  
  element.className = `${bgColor} p-4 rounded-xl font-medium`;
  element.innerHTML = message;
  element.classList.remove('hidden');
  
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
}

// Load recent uploads on page load
loadRecentUploads();
