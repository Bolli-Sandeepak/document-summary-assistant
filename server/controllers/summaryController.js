import mongoose from 'mongoose';
import DocumentModel from '../models/Document.js';
import { extractTextFromPDF } from '../services/pdfExtractor.js';
import { extractTextFromImage } from '../services/imageOcr.js';
import { generateDocumentAnalysis } from '../services/summarizer.js';
import { cleanExtractedText } from '../services/textCleaner.js';

/**
 * POST /api/analyze
 * Accepts a multipart file upload, processes the document, and returns
 * a JSON response with the analysis results.
 * 
 * Switched from SSE streaming to regular JSON for Vercel serverless compatibility.
 */
export async function analyzeDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      errorType: 'NO_FILE',
      error: 'No document file provided. Please upload a PDF, PNG, or JPG document.'
    });
  }

  const { originalname, mimetype, buffer, size } = req.file;
  const lowerName = originalname.toLowerCase();
  const isPdf = mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = mimetype.startsWith('image/') || /\.(png|jpe?g)$/.test(lowerName);

  console.log(`[UPLOAD] File received: "${originalname}" (${size} bytes, ${mimetype})`);

  if (!isPdf && !isImage) {
    return res.status(415).json({
      success: false,
      errorType: 'UNSUPPORTED_FORMAT',
      error: 'Unsupported file format. Please upload a PDF, JPG, JPEG, or PNG document.'
    });
  }

  let extractionResult = { text: '', method: '', pages: 1, isScanned: false, ocrConfidence: null };

  try {
    // ── PDF pipeline ─────────────────────────────────────────
    if (isPdf) {
      const pdfResult = await extractTextFromPDF(buffer, (event) => {
        // Progress events logged server-side (no SSE in serverless)
        console.log(`[PDF Progress] ${event.message}`);
      });

      extractionResult.text = pdfResult.text;
      extractionResult.method = pdfResult.extractionMethod;
      extractionResult.pages = pdfResult.pages;
      extractionResult.isScanned = pdfResult.isScanned;

      console.log(`[PDF] Pages: ${pdfResult.pages}, Method: ${pdfResult.extractionMethod}, Scanned: ${pdfResult.isScanned}, Extracted chars: ${pdfResult.text?.length || 0}`);

      if (!pdfResult.text || pdfResult.text.trim().length < 15) {
        return res.status(422).json({
          success: false,
          errorType: 'EXTRACTION_FAILED',
          error: 'Unable to extract readable text from this PDF. This may be a scanned or image-only PDF. Please upload a text-based PDF where you can select and copy text.'
        });
      }
    }

    // ── Image OCR pipeline ───────────────────────────────────
    if (isImage) {
      try {
        const ocrData = await extractTextFromImage(buffer);
        const cleanedOCR = cleanExtractedText(ocrData.text);
        extractionResult.text = cleanedOCR;
        extractionResult.method = 'Image OCR';
        extractionResult.ocrConfidence = ocrData.confidence;

        console.log(`[IMAGE] Extracted chars: ${cleanedOCR?.length || 0}, OCR Confidence: ${ocrData.confidence}%`);

        if (!cleanedOCR || cleanedOCR.trim().length < 15) {
          return res.status(422).json({
            success: false,
            errorType: 'OCR_FAILED',
            error: 'OCR could not detect readable text in this image. Please upload a clearer, higher-resolution image.'
          });
        }
      } catch (ocrErr) {
        console.error('[IMAGE] OCR processing failed:', ocrErr.message);
        return res.status(422).json({
          success: false,
          errorType: 'OCR_FAILED',
          error: 'Image text extraction failed. This feature may be limited in the current deployment. Please try uploading a PDF instead.'
        });
      }
    }

    // ── Summary generation ───────────────────────────────────
    console.log(`[SUMMARY] Sending ${extractionResult.text.length} characters to summarizer`);
    const analysis = await generateDocumentAnalysis(extractionResult.text, originalname);
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

    // ── MongoDB Storage (optional, non-blocking) ─────────────
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

    // ── Send final JSON response ─────────────────────────────
    return res.status(200).json({
      success: true,
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

    // Determine error type
    let errorType = 'PROCESSING_ERROR';
    let statusCode = 500;
    let message = err.message || 'An unexpected error occurred while processing your document.';

    if (err.message?.includes('Could not read the PDF')) {
      errorType = 'INVALID_PDF';
      statusCode = 422;
    } else if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
      errorType = 'TIMEOUT';
      statusCode = 504;
      message = 'Document processing timed out. Please try a smaller or simpler document.';
    } else if (err.message?.includes('Gemini API')) {
      errorType = 'AI_API_ERROR';
      statusCode = 502;
      message = 'AI summarization service is temporarily unavailable. Please try again in a moment.';
    }

    return res.status(statusCode).json({
      success: false,
      errorType,
      error: message
    });
  }
}

/**
 * GET /api/documents
 * Fetch metadata of all recently analyzed documents
 */
export async function getDocuments(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Document history is not available (database not connected).' });
    }
    const docs = await DocumentModel.find({}, '-extractedText')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch document history.' });
  }
}

/**
 * GET /api/documents/:id
 * Fetch complete details of a specific analyzed document
 */
export async function getDocumentById(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Document history is not available (database not connected).' });
    }
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document summary not found.' });
    }
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
    res.status(500).json({ success: false, error: 'Failed to fetch document details.' });
  }
}

/**
 * DELETE /api/documents/:id
 * Delete a specific document summary from the database
 */
export async function deleteDocument(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Document history is not available (database not connected).' });
    }
    const doc = await DocumentModel.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document summary not found.' });
    }
    res.json({ success: true, message: 'Document summary successfully deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete document summary.' });
  }
}
