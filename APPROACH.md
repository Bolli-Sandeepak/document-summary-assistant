# Approach Write-Up: Document Summary Assistant

The Document Summary Assistant is a full-stack web application designed for seamless document content extraction and multi-level summarization.

Users upload PDF or image files (JPG, PNG) via an interactive drag-and-drop interface with real-time format and file size validation.

The Express backend routes documents through specialized processing pipelines: selectable-text PDFs are parsed using `pdf-parse`, while scanned images undergo Optical Character Recognition (OCR) via `tesseract.js`.

Extracted text is processed by Google Gemini API (with an automated statistical fallback engine for offline reliability) to generate structured JSON payloads. The application produces three selectable summary lengths (Short, Medium, Long), extracts numbered key-point insight cards, and suggests actionable document improvements.

Communication between the React frontend and Express backend utilizes RESTful endpoints (`POST /api/analyze`) with `multipart/form-data` payload streams and in-memory buffer processing for complete user privacy.

The architecture is streamlined for cloud deployment: the Vite React frontend deploys to Vercel/Netlify, while the Node.js Express server runs on Render. Environment variables safeguard API secrets, CORS policies protect endpoints, and custom CSS design tokens deliver a modern, responsive document reader experience across all devices.
