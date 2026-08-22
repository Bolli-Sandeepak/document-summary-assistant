# Approach Write-Up: Document Summary Assistant

The Document Summary Assistant is a full-stack web application designed for automated document text extraction and intelligent multi-level summarization.

### Architecture & Pipeline
1. **Document Upload & Ingestion:** Users upload PDF documents or scanned images (PNG, JPG) via an intuitive drag-and-drop or file picker interface with real-time format and size validation.
2. **Text Extraction:** Selectable PDFs are parsed using an enhanced spatial renderer with `pdf-parse` that preserves line breaks, column structures, and headings while repairing joined words and OCR artifacts. Scanned images are processed via `tesseract.js` OCR.
3. **Smart Summarization:** Extracted text is analyzed using Google Gemini AI (`gemini-3.5-flash`) with chunking for large documents (or a local statistical fallback engine if offline). The system generates structured JSON payloads with:
   - **Multi-Level Summaries:** Short (2-3 sentences), Medium (2-3 paragraphs), and Long (comprehensive).
   - **Key Points:** Numbered core concepts and essential takeaways.
   - **Important Terms:** Domain-specific terms with concise explanations.
   - **Improvement Suggestions:** Actionable feedback on document depth and clarity.
4. **Cloud Deployment:** Deployed seamlessly on Vercel with serverless API routing, CORS protection, responsive mobile/desktop UI, and optional MongoDB Atlas history storage.
