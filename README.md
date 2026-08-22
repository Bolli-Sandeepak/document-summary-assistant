# Document Summary Assistant

> **Turn lengthy documents into clear, structured summaries instantly.**  
> A production-quality web application built with React, Node.js, Express, Tesseract.js OCR, MongoDB Atlas, and Google Gemini AI.

---

## 🌐 Live Application & Repository

- **Live URL:** [https://document-summary-assistant-gules-eta.vercel.app](https://document-summary-assistant-gules-eta.vercel.app)
- **GitHub Repository:** [https://github.com/Bolli-Sandeepak/document-summary-assistant](https://github.com/Bolli-Sandeepak/document-summary-assistant)
- **Approach Write-Up (200 words max):** [`APPROACH.md`](./APPROACH.md)

---

## 📑 Overview

**Document Summary Assistant** is an intelligent full-stack SaaS application that allows users to upload documents (PDFs, scanned images, lecture slides, papers), automatically extracts text, and generates smart multi-level summaries, numbered key takeaways, important terminology definitions, and actionable improvement recommendations.

---

## ✨ Features

### 1. Document Upload
- **Drag-and-Drop & File Picker:** Intuitive upload zone supporting PDF files (`.pdf`) and image files (`.png`, `.jpg`, `.jpeg`) up to 15MB.
- **Client-Side Validation:** Instant file type and size verification with clear error alerts.

### 2. Text Extraction & Cleaning
- **Spatial PDF Parsing:** Enhanced `pdf-parse` custom page renderer preserving headings, paragraphs, bullet points, and multi-column formatting without joining unrelated words.
- **OCR (Optical Character Recognition):** Automatic OCR for scanned documents and images using `tesseract.js`.
- **Text Post-Processing:** Regex cleaning that repairs camelCase joins, missing punctuation spaces, broken hyphenation, and OCR artifacts.

### 3. Smart Summary Generation
- **Multi-Level Length Options:**
  - **Short:** 2–3 concise sentences capturing the core topic and main takeaway.
  - **Medium:** 2–3 structured paragraphs covering context, key concepts, and conclusions.
  - **Long:** Detailed, comprehensive breakdown covering background, methodology, concepts, and findings.
- **Key Points & Main Ideas:** 5–8 distinct, numbered concept cards capturing core insights.
- **Important Terms:** Domain-specific technical terms and acronyms paired with clear definitions.
- **Improvement Suggestions:** Actionable recommendations on depth, structural clarity, examples, and terminology.

### 4. UI/UX & Interactivity
- **Simple, Responsive Interface:** Minimalist productivity design built with custom CSS design tokens.
- **Mobile-Responsive:** Optimized for seamless performance on Android/iOS mobile browsers, tablets, and desktop.
- **Export Actions:** One-click copy for summaries/key points and `.txt` file export.
- **Dark / Light Theme Toggle:** Instant theme switching with local storage persistence.
- **Animated Processing States:** Live stage indicators keeping users informed during extraction and analysis.

### 5. Hosting & Production Architecture
- **Unified Vercel Serverless Architecture:** Both React Frontend and Express Backend deployed on Vercel with zero external hosting dependencies.
- **CORS & Environment Protection:** Strict origin handling and zero-secret exposure.
- **MongoDB Atlas Integration:** Document history persistence with non-blocking serverless connection pooling.
- **Offline / Local Fallback Summarizer:** Built-in statistical heuristic engine ensuring the app functions seamlessly even without an AI key.

---

## 🛠️ Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Lucide React Icons, Custom CSS Design System |
| **Backend** | Node.js, Express.js, Multer (Memory Storage), CORS |
| **Database** | MongoDB Atlas / Mongoose |
| **Text Extraction & OCR** | `pdf-parse` (Spatial Renderer), `tesseract.js` |
| **AI Summarization** | Google Gemini 3.5 Flash API (`gemini-3.5-flash`) + Local Statistical Heuristic Engine |
| **Hosting & Deployment** | Vercel (Serverless Functions & Static Edge Hosting) |

---

## 📐 System Architecture

```
User (Desktop / Android Mobile)
         │
         ▼
Vercel Edge Network
         │
 ┌───────┴────────────────────────────┐
 │                                    │
 ▼                                    ▼
React Frontend (Vite SPA)       Express Serverless API
 [client/dist/index.html]        [POST /api/analyze]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  PDF Spatial Parser        Image OCR (Tesseract)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                                Text Cleaning
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                 Gemini 3.5 Flash API       Local Statistical Engine
                 (with smart chunking)       (offline fallback)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                               JSON Response
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  MongoDB Storage           React Workspace UI
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Bolli-Sandeepak/document-summary-assistant.git
cd document-summary-assistant
```

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Configure Environment Variables
Create a `.env` file inside the `server/` folder:
```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=http://localhost:5173,http://localhost:3000
```

### 4. Start the Application
- Start Backend: `npm run dev:server` (runs on `http://localhost:5000`)
- Start Frontend: `npm run dev:client` (runs on `http://localhost:5173`)
- Open `http://localhost:5173` in your browser.

---

## 📝 Assessment Deliverables Summary

1. **Working Application URL:** [https://document-summary-assistant-gules-eta.vercel.app](https://document-summary-assistant-gules-eta.vercel.app)
2. **GitHub Repository:** [https://github.com/Bolli-Sandeepak/document-summary-assistant](https://github.com/Bolli-Sandeepak/document-summary-assistant)
3. **Approach Write-Up:** [`APPROACH.md`](./APPROACH.md) (Under 200 words)

---

## 📄 License
MIT License
