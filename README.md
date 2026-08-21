# Document Summary Assistant

> **Turn lengthy documents into clear, structured summaries instantly.**  
> A production-quality web application built with React, Node.js, Express, Tesseract.js OCR, MongoDB Atlas, and Google Gemini API.

---

## Overview

**Document Summary Assistant** allows users to upload PDF documents and scanned images (PNG, JPG, JPEG), automatically extracts document text, and generates multi-level summaries (Short, Medium, Long), numbered key points, important technical terms, and actionable improvement recommendations.

The interface is engineered with a clean, human-designed productivity app layout (inspired by Notion / Linear / GitHub)—no unnecessary AI buzzwords or distracting glowing effects, just a responsive, high-performance SaaS document workspace.

---

## Key Features

- **Document Upload**: Drag-and-drop dropzone and file picker supporting `.pdf`, `.png`, `.jpg`, and `.jpeg` (up to 15MB).
- **PDF Text Parsing**: Direct text extraction for selectable PDFs via `pdf-parse` / `pdfjs-dist` preserving formatting, bullet points, hyphenated terms, and structural layout.
- **High-Resolution Image OCR**: Automatic Optical Character Recognition (OCR) for scanned PDFs and image files via `tesseract.js` rendered at 200 DPI (`scale: 2.2`).
- **Multi-Level Summary Options**: Toggle between **Short** (2-3 sentences), **Medium** (2-3 structured paragraphs), and **Long** (detailed comprehensive breakdown) summary lengths.
- **Key Points & Main Ideas**: Highlights 4-6 distinct, numbered concept cards capturing core document insights.
- **Important Technical Terms**: Automatically extracts 4-8 key technical terms, acronyms, or concepts defined in the text with clear definitions.
- **Actionable Improvement Suggestions**: Categorized document feedback covering content depth, structural clarity, and evidence.
- **Inspectable Raw Text Viewer**: Scrollable code block viewer displaying complete extracted text and character count.
- **Export & Copy Actions**: One-click copying of summaries, key points, or raw text to clipboard and `.txt` file download.
- **MongoDB Atlas Integration**: Persists document summaries and metadata for instant history retrieval.
- **Resilient Offline Fallback Summarizer**: Includes a local statistical sentence scoring engine that operates seamlessly if no Gemini API key is configured.
- **Real-Time Progress Checklist**: Live Server-Sent Events (SSE) stream displaying checklist progress (`✓ Document received`, `✓ Checking document`, `→ Extracting text`, `○ Preparing summary`).
- **Dark / Light Theme Toggle**: Modern productivity styling with persistent dark/light theme options.
- **Mobile-Responsive Design**: Tailored layout for seamless use across desktop, tablet, and mobile screens.

---

## Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Lucide React Icons, Custom CSS Design System |
| **Backend** | Node.js, Express.js, Multer (Memory Storage), SSE Streaming, CORS |
| **Database** | MongoDB Atlas / Mongoose |
| **Parsing & OCR** | `pdf-parse`, `pdfjs-dist`, `@napi-rs/canvas`, `tesseract.js` |
| **Summarization** | Google Gemini 2.5 Flash API (`gemini-2.5-flash`) + Local Heuristic Fallback |

---

## Technical Assessment Deliverables

1. **Working Application**: Full-stack application running with local dev servers or cloud hosting (Render + Vercel/Netlify).
2. **GitHub Repository & Documentation**: Clean, structured code with comprehensive [`README.md`](file:///c:/Users/sande/OneDrive/Documents/docsummary/README.md).
3. **Approach Write-Up**: Concise 170-word technical overview in [`APPROACH.md`](file:///c:/Users/sande/OneDrive/Documents/docsummary/APPROACH.md).

---

## System Architecture Workflow

```
[ User File Upload ]
        │ (PDF / JPG / PNG)
        ▼
[ Express API Server ] ───> [ File Validation & Memory Buffer ]
                                       │
            ┌─────────────────────────┴────────────────────────┐
            ▼                                                  ▼
   [ PDF Parsing Pipeline ]                           [ Image OCR Pipeline ]
   (pdf-parse / pdfjs-dist)                            (tesseract.js @ 2.2 scale)
            │                                                  │
            └─────────────────────────┬────────────────────────┘
                                      ▼
                           [ Extracted Text ]
                                      │
                                      ▼
                        [ Summarizer Service ]
          ┌───────────────────────────┴───────────────────────────┐
          ▼                                                       ▼
 [ Gemini 2.5 API ]                                    [ Local Fallback Engine ]
 (With large document chunking >25k chars)             (If API Key missing/fails)
          │                                                       │
          └───────────────────────────┬───────────────────────────┘
                                      ▼
                         [ Structured JSON Response ]
                   (Summaries, Key Points, Terms, Suggestions)
                                      │
                                      ▼
                         [ MongoDB Atlas Storage ]
                                      │
                                      ▼
                          [ React Workspace UI ]
```

---

## Project Structure

```
docsummary/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Header, UploadZone, ProcessingView, ResultsView, ErrorBanner
│   │   ├── services/           # API fetch wrapper (api.js)
│   │   ├── App.jsx             # Main state machine
│   │   └── index.css           # Master CSS design system (tokens & dark/light themes)
│   ├── index.html              # HTML shell & Google Fonts
│   ├── vite.config.js          # Vite config & API proxy
│   └── package.json            # Client dependencies
│
├── server/                     # Express Node.js Backend
│   ├── controllers/            # summaryController.js
│   ├── models/                 # Document.js (Mongoose Schema)
│   ├── routes/                 # summaryRoutes.js
│   ├── services/               # pdfExtractor.js, imageOcr.js, textCleaner.js, summarizer.js
│   ├── middleware/             # errorHandler.js
│   ├── server.js               # Express server entry point
│   ├── .env.example            # Backend environment template
│   └── package.json            # Backend dependencies
│
├── APPROACH.md                 # 170-word technical approach write-up
├── README.md                   # Complete project documentation
├── .env.example                # Root environment template
└── package.json                # Root helper scripts
```

---

## Getting Started Locally

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **MongoDB Atlas Connection URI** (or local MongoDB)

### 1. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Configuration
Create a `.env` file inside `server/`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Run the Application

Start backend server:
```bash
cd server
npm run dev
# Server runs at http://localhost:5000
```

Start frontend client:
```bash
cd client
npm run dev
# Client runs at http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## Approach Write-Up (200 Words Max)

> The Document Summary Assistant is a full-stack web application designed for seamless document content extraction and multi-level summarization.
> 
> Users upload PDF or image files (JPG, PNG) via an interactive drag-and-drop interface with real-time format and file size validation.
> 
> The Express backend routes documents through specialized processing pipelines: selectable-text PDFs are parsed using `pdf-parse`, while scanned images undergo Optical Character Recognition (OCR) via `tesseract.js`.
> 
> Extracted text is processed by Google Gemini API (with an automated statistical fallback engine for offline reliability) to generate structured JSON payloads. The application produces three selectable summary lengths (Short, Medium, Long), extracts numbered key-point insight cards, and suggests actionable document improvements.
> 
> Communication between the React frontend and Express backend utilizes RESTful endpoints (`POST /api/analyze`) with `multipart/form-data` payload streams and in-memory buffer processing for complete user privacy.
> 
> The architecture is streamlined for cloud deployment: the Vite React frontend deploys to Vercel/Netlify, while the Node.js Express server runs on Render. Environment variables safeguard API secrets, CORS policies protect endpoints, and custom CSS design tokens deliver a modern, responsive document reader experience across all devices.
