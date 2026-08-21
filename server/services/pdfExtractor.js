import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { cleanExtractedText } from './textCleaner.js';

// ────────────────────────────────────────────────────────────────
// Optional rendering dependencies (pdfjs-dist + canvas)
// Loaded lazily so the server starts even if they're not installed.
// ────────────────────────────────────────────────────────────────
let pdfjsLib = null;
let createCanvas = null;

function loadRenderingDeps() {
  if (pdfjsLib && createCanvas) return true;
  try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    // Disable the web worker — not available in Node.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    // Try loading @napi-rs/canvas first, then fallback to canvas
    let canvasPkg;
    try {
      canvasPkg = require('@napi-rs/canvas');
    } catch {
      canvasPkg = require('canvas');
    }
    createCanvas = canvasPkg.createCanvas;
    return true;
  } catch (err) {
    console.warn('[pdfExtractor] canvas/pdfjs-dist not available:', err.message);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────
// Heuristic: is the text extracted from this page sufficient?
// ────────────────────────────────────────────────────────────────
const WORDS_PER_PAGE_THRESHOLD = 25; // below this → OCR the page

function pageNeedsOCR(pageText) {
  const words = (pageText || '').split(/\s+/).filter(w => w.length > 1);
  return words.length < WORDS_PER_PAGE_THRESHOLD;
}

function overallNeedsOCR(text, pageCount) {
  const words = (text || '').split(/\s+/).filter(w => w.length > 1);
  const avgWordsPerPage = words.length / Math.max(pageCount, 1);
  return avgWordsPerPage < WORDS_PER_PAGE_THRESHOLD;
}

// ────────────────────────────────────────────────────────────────
// Step 1 — Quick extraction via pdf-parse
// ────────────────────────────────────────────────────────────────
async function quickExtract(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      text: (data.text || '').replace(/\r\n/g, '\n').trim(),
      pages: data.numpages || 1,
    };
  } catch (err) {
    throw new Error(`Could not read the PDF file: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────
// Step 2 — Per-page text extraction via pdfjs-dist
// ────────────────────────────────────────────────────────────────
async function getPerPageTexts(buffer) {
  const data = new Uint8Array(buffer);
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pageCount = pdfDoc.numPages;
  const pageTexts = [];

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => (item.str || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pageTexts.push(text);
    } catch {
      pageTexts.push('');
    }
  }

  return { pdfDoc, pageTexts, pageCount };
}

// ────────────────────────────────────────────────────────────────
// Step 3 — Render a single page to a PNG buffer for OCR
// ────────────────────────────────────────────────────────────────
async function renderPageToImage(pdfDoc, pageNum, scale) {
  const targetScale = scale || (process.env.NODE_ENV === 'production' ? 1.6 : 2.0);
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: targetScale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;
  const buf = canvas.toBuffer('image/png');
  return buf;
}

// ────────────────────────────────────────────────────────────────
// Main export — full hybrid PDF extraction pipeline
// onProgress(event) emits structured progress objects to the caller
// ────────────────────────────────────────────────────────────────
export async function extractTextFromPDF(buffer, onProgress) {
  const emit = (msg, extra = {}) => onProgress?.({ type: 'progress', message: msg, ...extra });

  // ── Step 1: Quick text extraction ─────────────────────────────
  emit('Checking document...', { step: 'checking' });
  const { text: quickText, pages: pageCount } = await quickExtract(buffer);

  emit('Extracting text...', { step: 'extracting' });

  // ── Step 2: Is the text good enough without OCR? ──────────────
  if (!overallNeedsOCR(quickText, pageCount)) {
    const cleaned = cleanExtractedText(quickText);
    return {
      text: cleaned,
      pages: pageCount,
      extractionMethod: 'PDF Text Extraction',
      isScanned: false,
    };
  }

  // ── Step 3: Need per-page hybrid extraction ───────────────────
  emit('Scanned content detected — analyzing pages...', { step: 'ocr_detect' });

  // Check if rendering dependencies are available
  if (!loadRenderingDeps()) {
    // Fallback: return what pdf-parse gave us, cleaned
    const cleaned = cleanExtractedText(quickText);
    return {
      text: cleaned || 'Could not extract sufficient text from this PDF. Try uploading as an image (PNG/JPG) for OCR.',
      pages: pageCount,
      extractionMethod: 'PDF Text Extraction (Limited)',
      isScanned: true,
    };
  }

  // ── Step 4: Per-page analysis ─────────────────────────────────
  let perPageData;
  try {
    perPageData = await getPerPageTexts(buffer);
  } catch (err) {
    console.warn('[pdfExtractor] Per-page extraction failed:', err.message);
    const cleaned = cleanExtractedText(quickText);
    return {
      text: cleaned,
      pages: pageCount,
      extractionMethod: 'PDF Text Extraction (Partial)',
      isScanned: false,
    };
  }

  const { pdfDoc, pageTexts, pageCount: totalPages } = perPageData;
  const pagesNeedingOCR = pageTexts.filter(pageNeedsOCR).length;

  emit(
    pagesNeedingOCR > 0
      ? `Reading document — ${pagesNeedingOCR} of ${totalPages} pages require OCR...`
      : 'Extracting content from all pages...',
    { step: pagesNeedingOCR > 0 ? 'ocr_detect' : 'extracting', ocrNeeded: pagesNeedingOCR > 0, totalPages }
  );

  // ── Step 5: Lazy-import tesseract to avoid double-loading ──────
  const { createWorker } = await import('tesseract.js');
  let ocrWorker = null;
  if (pagesNeedingOCR > 0) {
    try {
      ocrWorker = await createWorker('eng');
    } catch (workerErr) {
      console.warn('[pdfExtractor] Failed to initialize Tesseract worker:', workerErr.message);
    }
  }

  const textParts = [];
  let usedOCR = false;

  try {
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const pageText = pageTexts[i] || '';

      if (!pageNeedsOCR(pageText) || !ocrWorker) {
        // Good text extraction for this page or OCR unavailable
        if (pageText.trim()) {
          textParts.push(pageText);
        }
      } else {
        // OCR this page with 25s timeout limit
        onProgress?.({
          type: 'progress',
          step: 'ocr_pages',
          message: `Extracting text from page ${pageNum} of ${totalPages}...`,
          current: pageNum,
          total: totalPages,
        });

        try {
          const imageBuffer = await renderPageToImage(pdfDoc, pageNum, 2.2);
          
          const ocrPromise = ocrWorker.recognize(imageBuffer);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`OCR timeout on page ${pageNum}`)), 60000)
          );
          
          const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
          const ocrText = (ocrResult.data.text || '').replace(/\r\n/g, '\n').trim();

          if (ocrText.length > 15) {
            textParts.push(ocrText);
            usedOCR = true;
          } else if (pageText.trim()) {
            textParts.push(pageText);
          }
        } catch (ocrErr) {
          console.warn(`[pdfExtractor] OCR skipped for page ${pageNum}:`, ocrErr.message);
          if (pageText.trim()) textParts.push(pageText);
        }
      }
    }
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate().catch(() => {});
    }
  }

  // ── Step 7: Combine, clean, return ────────────────────────────
  const combinedRaw = textParts.join('\n\n');
  const cleaned = cleanExtractedText(combinedRaw);

  return {
    text: cleaned || quickText || 'Text extraction was not successful for this document.',
    pages: totalPages,
    extractionMethod: usedOCR ? 'PDF + OCR' : 'PDF Text Extraction',
    isScanned: usedOCR,
  };
}
