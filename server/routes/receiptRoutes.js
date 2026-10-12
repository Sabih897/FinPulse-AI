// server/routes/receiptRoutes.js
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Primary fallback list if listing fails
const DEFAULT_CANDIDATES = [
  'gemini-3.8-flash',
  'gemma-4-26b-a4b-it'
];

router.post('/scan-receipt', protect, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt file uploaded.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing from server/.env file.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    // Use a short, verified fallback list. Listing every generateContent model also
    // includes text-to-speech models that cannot accept receipt images.
    const candidateModels = [...DEFAULT_CANDIDATES];

    let response = null;
    let lastError = null;

    // Loop through dynamic candidates until one succeeds
    for (const modelName of candidateModels) {
      try {
        console.log(`Attempting receipt scan with model: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: { mimeType, data: imageBase64 }
            },
            'Extract receipt details strictly using the provided JSON schema.'
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                merchant: { type: 'STRING' },
                amount: { type: 'NUMBER' },
                date: { type: 'STRING' },
                category: { 
                  type: 'STRING', 
                  enum: ['Groceries', 'Utilities', 'Dining', 'Entertainment', 'Transport', 'Healthcare', 'Subscriptions', 'Shopping', 'Others'] 
                },
                lineItems: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      price: { type: 'NUMBER' }
                    }
                  }
                },
                confidenceScore: { type: 'NUMBER' }
              },
              required: ['merchant', 'amount', 'date', 'category']
            }
          }
        });

        if (response?.text) {
          console.log(`Successfully scanned receipt using model: ${modelName}`);
          break; // Exit loop on success
        }
      } catch (err) {
        console.warn(`Model ${modelName} failed (${err.message}), trying next candidate...`);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All available Gemini models failed.');
    }

    const rawText = response.text;
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    return res.json({ success: true, data: parsedData });

  } catch (error) {
    console.error('OCR Extraction Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process receipt with AI.' 
    });
  }
});

export default router;