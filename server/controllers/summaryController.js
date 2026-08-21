import mongoose from 'mongoose';
import DocumentModel from '../models/Document.js';
import { extractTextFromPDF } from '../services/pdfExtractor.js';
import { extractTextFromImage } from '../services/imageOcr.js';
import { generateDocumentAnalysis } from '../services/summarizer.js';
import { cleanExtractedText } from '../services/textCleaner.js';

/**
 * POST /api/analyze
 * Accepts a multipart file upload, responds with an SSE stream of progress events
 * followed by the final analysis result. Saves to MongoDB if connection is active.
 */
export async function analyzeDocument(req, res) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keep-alive heartbeat every 10 seconds to prevent connection timeouts during long OCR/Gemini jobs
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 10000);

  const cleanup = () => clearInterval(heartbeatTimer);

  const send = (type, payload = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const sendProgress = (message, extra = {}) => send('progress', { message, ...extra });
  const sendComplete = (data) => { cleanup(); send('complete', data); res.end(); };
  const sendError = (message) => { cleanup(); send('error', { message }); res.end(); };

  req.on('close', cleanup);

  if (!req.file) {
    return sendError('No document file provided. Please upload a PDF, PNG, or JPG document.');
  }

  const { originalname, mimetype, buffer, size } = req.file;
  const lowerName = originalname.toLowerCase();
  const isPdf = mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = mimetype.startsWith('image/') || /\.(png|jpe?g)$/.test(lowerName);

  console.log(`[UPLOAD] File received: "${originalname}" (${size} bytes, ${mimetype})`);

  if (!isPdf && !isImage) {
    return sendError('Unsupported file format. Please upload a PDF, JPG, JPEG, or PNG document.');
  }

  let extractionResult = { text: '', method: '', pages: 1, isScanned: false, ocrConfidence: null };

  try {
    // ── PDF pipeline ─────────────────────────────────────────
    if (isPdf) {
      const pdfResult = await extractTextFromPDF(buffer, (event) => {
        sendProgress(event.message, {
          step: event.step || (event.current ? 'ocr_pages' : 'extracting'),
          current: event.current,
          total: event.total
        });
      });

      extractionResult.text = pdfResult.text;
      extractionResult.method = pdfResult.extractionMethod;
      extractionResult.pages = pdfResult.pages;
      extractionResult.isScanned = pdfResult.isScanned;

      console.log(`[PDF] Pages: ${pdfResult.pages}, Method: ${pdfResult.extractionMethod}, Scanned: ${pdfResult.isScanned}, Extracted chars: ${pdfResult.text?.length || 0}`);

      if (!pdfResult.text || pdfResult.text.trim().length < 15) {
        return sendError('Unable to extract readable text from this PDF. This may be a scanned or image-only PDF without clear text. Please upload a text-based PDF or higher resolution scan.');
      }
    }

    // ── Image OCR pipeline ───────────────────────────────────
    if (isImage) {
      sendProgress('Reading document...', { step: 'extracting' });
      sendProgress('Extracting text from image...', { step: 'ocr_page' });

      const ocrData = await extractTextFromImage(buffer);
      const cleanedOCR = cleanExtractedText(ocrData.text);
      extractionResult.text = cleanedOCR;
      extractionResult.method = 'Image OCR';
      extractionResult.ocrConfidence = ocrData.confidence;

      console.log(`[IMAGE] Extracted chars: ${cleanedOCR?.length || 0}, OCR Confidence: ${ocrData.confidence}%`);

      if (!cleanedOCR || cleanedOCR.trim().length < 15) {
        return sendError('OCR could not detect readable text in this image. Please upload a clearer, higher-resolution image.');
      }
    }

    // ── Summary generation ───────────────────────────────────
    sendProgress('Preparing summary...', { step: 'summarizing' });
    console.log(`[SUMMARY] Sending ${extractionResult.text.length} characters to summarizer module`);

    const analysis = await generateDocumentAnalysis(extractionResult.text, originalname);

    sendProgress('Organizing key points...', { step: 'organizing' });
    console.log(`[SUMMARY] Completed analysis for "${originalname}"`);

    // ── Build statistics ─────────────────────────────────────
    const wordCount = extractionResult.text.trim().split(/\s+/).filter(Boolean).length;
    const charCount = extractionResult.text.length;

    const resultPayload = {
      filename: originalname,
      fileSize: size,
      mimeType: mimetype,
      wordCount,
      charCount,
      pages: extractionResult.pages,
      extractionMethod: extractionResult.method,
      ocrConfidence: extractionResult.ocrConfidence,
      isScannedPdf: extractionResult.isScanned
    };

    // ── MongoDB Storage ──────────────────────────────────────
    let dbId = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const savedDoc = await DocumentModel.create({
          filename: originalname,
          fileSize: size,
          mimeType: mimetype,
          wordCount,
          charCount,
          pages: extractionResult.pages,
          extractionMethod: extractionResult.method,
          ocrConfidence: extractionResult.ocrConfidence,
          isScannedPdf: extractionResult.isScanned,
          extractedText: extractionResult.text,
          summaries: analysis.summaries,
          keyPoints: analysis.keyPoints,
          importantTerms: analysis.importantTerms,
          improvementSuggestions: analysis.improvementSuggestions
        });
        dbId = savedDoc._id;
        console.log(`[Database] Saved document summary: ${originalname} (ID: ${dbId})`);
      } catch (dbErr) {
        console.error('[Database] Failed to save document:', dbErr.message);
      }
    }

    sendComplete({
      _id: dbId,
      document: resultPayload,
      extractedText: extractionResult.text,
      summaries: analysis.summaries,
      keyPoints: analysis.keyPoints,
      importantTerms: analysis.importantTerms,
      improvementSuggestions: analysis.improvementSuggestions
    });

  } catch (err) {
    console.error('[analyzeDocument] Fatal error:', err);
    sendError(err.message || 'An unexpected error occurred while processing your document.');
  }
}

/**
 * GET /api/documents
 * Fetch metadata of all recently analyzed documents (excluding full extracted text for speed)
 */
export async function getDocuments(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Database storage is disabled or offline' });
    }
    const docs = await DocumentModel.find({}, '-extractedText')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/documents/:id
 * Fetch complete details of a specific analyzed document
 */
export async function getDocumentById(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Database storage is disabled or offline' });
    }
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document summary not found' });
    }
    // Format to match the analyzer response structure
    res.json({
      success: true,
      data: {
        _id: doc._id,
        document: {
          filename: doc.filename,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          wordCount: doc.wordCount,
          charCount: doc.charCount,
          pages: doc.pages,
          extractionMethod: doc.extractionMethod,
          ocrConfidence: doc.ocrConfidence,
          isScannedPdf: doc.isScannedPdf
        },
        extractedText: doc.extractedText,
        summaries: doc.summaries,
        keyPoints: doc.keyPoints,
        importantTerms: doc.importantTerms,
        improvementSuggestions: doc.improvementSuggestions,
        createdAt: doc.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/documents/:id
 * Delete a specific document summary from the database
 */
export async function deleteDocument(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Database storage is disabled or offline' });
    }
    const doc = await DocumentModel.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document summary not found' });
    }
    res.json({ success: true, message: 'Document summary successfully deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
