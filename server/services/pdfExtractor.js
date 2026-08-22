import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { cleanExtractedText } from './textCleaner.js';

// ────────────────────────────────────────────────────────────────
// Minimum viable text thresholds
// ────────────────────────────────────────────────────────────────
const MIN_CHARS_FOR_VALID_TEXT = 50;
const WORDS_PER_PAGE_THRESHOLD = 15; // below this = likely scanned

/**
 * Main PDF text extraction pipeline.
 * Uses pdf-parse for text extraction with enhanced post-processing.
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, pages: number, extractionMethod: string, isScanned: boolean}>}
 */
export async function extractTextFromPDF(buffer, onProgress) {
  const emit = (msg, extra = {}) => onProgress?.({ type: 'progress', message: msg, ...extra });

  // ── Step 1: Extract text using pdf-parse ──────────────────────
  emit('Reading document...', { step: 'checking' });

  let rawText = '';
  let pageCount = 1;

  try {
    const data = await pdfParse(buffer, {
      // Custom page renderer to get better text from each page
      pagerender: renderPage
    });
    rawText = (data.text || '').trim();
    pageCount = data.numpages || 1;
  } catch (err) {
    throw new Error(`Could not read the PDF file. It may be corrupted or password-protected: ${err.message}`);
  }

  emit('Extracting text...', { step: 'extracting' });
  console.log(`[PDF] Raw extraction: ${pageCount} pages, ${rawText.length} chars`);

  // ── Step 2: Check if PDF is scanned/image-based ───────────────
  const wordCount = rawText.split(/\s+/).filter(w => w.length > 1).length;
  const avgWordsPerPage = wordCount / Math.max(pageCount, 1);
  const isScanned = avgWordsPerPage < WORDS_PER_PAGE_THRESHOLD;

  if (isScanned || rawText.length < MIN_CHARS_FOR_VALID_TEXT) {
    console.log(`[PDF] Detected as scanned/image-based (avg ${avgWordsPerPage.toFixed(1)} words/page)`);

    // Return what we have with a clear flag
    const cleaned = cleanExtractedText(rawText);
    return {
      text: cleaned || 'This PDF appears to be scanned or image-based. Text extraction is limited for this type of document. For better results, please upload a text-based PDF where you can select and copy text.',
      pages: pageCount,
      extractionMethod: 'PDF Text Extraction (Limited)',
      isScanned: true,
    };
  }

  // ── Step 3: Clean and normalize the extracted text ────────────
  emit('Processing text...', { step: 'cleaning' });

  const cleaned = cleanExtractedText(rawText);

  console.log(`[PDF] Cleaned text: ${cleaned.length} chars (from ${rawText.length} raw chars)`);

  return {
    text: cleaned,
    pages: pageCount,
    extractionMethod: 'PDF Text Extraction',
    isScanned: false,
  };
}

/**
 * Custom page renderer for pdf-parse.
 * Extracts text content from each page with better formatting.
 * This function is called by pdf-parse for each page.
 */
async function renderPage(pageData) {
  try {
    const textContent = await pageData.getTextContent();
    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return '';
    }

    const lines = [];
    let currentLine = '';
    let lastY = null;
    let lastX = null;
    let lastWidth = 0;
    let lastFontSize = 0;

    for (const item of textContent.items) {
      if (!item.str && !item.str === '') continue;

      const text = item.str;
      const transform = item.transform || [];
      const fontSize = transform[0] || 12;
      const x = transform[4] || 0;
      const y = transform[5] || 0;
      const width = item.width || 0;

      if (lastY === null) {
        // First item
        currentLine = text;
        lastY = y;
        lastX = x;
        lastWidth = width;
        lastFontSize = fontSize;
        continue;
      }

      // Detect line break: Y position changed significantly
      const yDiff = Math.abs(y - lastY);
      const lineBreakThreshold = Math.max(fontSize * 0.5, 3);

      if (yDiff > lineBreakThreshold) {
        // New line — push the current line
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }

        // If Y difference is large, this might be a paragraph break
        const paragraphThreshold = fontSize * 1.8;
        if (yDiff > paragraphThreshold && currentLine.trim()) {
          lines.push(''); // Empty line = paragraph break
        }

        currentLine = text;
        lastY = y;
        lastX = x;
        lastWidth = width;
        lastFontSize = fontSize;
        continue;
      }

      // Same line — check if we need a space between items
      const expectedX = lastX + lastWidth;
      const gap = x - expectedX;
      const spaceWidth = fontSize * 0.3;

      if (gap > spaceWidth) {
        // Gap between items — add a space
        currentLine += ' ' + text;
      } else if (gap < -fontSize * 0.5) {
        // Overlapping or far left — likely a new column or repositioned text
        currentLine += ' ' + text;
      } else {
        // Adjacent items — check if space is needed
        if (text.length > 0 && currentLine.length > 0) {
          const lastChar = currentLine[currentLine.length - 1];
          const firstChar = text[0];

          // Add space if the last char is alphanumeric and first char is also alphanumeric
          if (/[a-zA-Z0-9,;:.]/.test(lastChar) && /[a-zA-Z0-9(]/.test(firstChar) && gap > 0.5) {
            currentLine += ' ' + text;
          } else {
            currentLine += text;
          }
        } else {
          currentLine += text;
        }
      }

      lastY = y;
      lastX = x;
      lastWidth = width;
      lastFontSize = fontSize;
    }

    // Push the last line
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    // Join lines with newlines and add page separator
    return lines.join('\n') + '\n\n';
  } catch (err) {
    // Fallback: use default text extraction
    try {
      const textContent = await pageData.getTextContent();
      return textContent.items.map(item => item.str).join(' ') + '\n\n';
    } catch {
      return '';
    }
  }
}
