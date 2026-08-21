import { createWorker } from 'tesseract.js';

/**
 * Extracts text from an image buffer using Tesseract OCR.
 * 
 * @param {Buffer} imageBuffer - Buffer containing JPG/PNG image
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function extractTextFromImage(imageBuffer) {
  let worker = null;
  try {
    worker = await createWorker('eng');
    
    const ret = await worker.recognize(imageBuffer);
    const rawText = ret.data.text || '';
    const confidence = ret.data.confidence || 0;

    const cleanedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text: cleanedText,
      confidence: Math.round(confidence)
    };
  } catch (error) {
    console.error('OCR Error:', error.message);
    throw new Error(`Failed to perform OCR on image document: ${error.message}`);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
