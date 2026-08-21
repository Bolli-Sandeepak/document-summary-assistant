import express from 'express';
import multer from 'multer';
import { 
  analyzeDocument, 
  getDocuments, 
  getDocumentById, 
  deleteDocument 
} from '../controllers/summaryController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const lowerName = file.originalname.toLowerCase();
    const validExt = /\.(pdf|png|jpe?g)$/.test(lowerName);
    if (allowed.includes(file.mimetype) || validExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are supported.'));
    }
  }
});

// Document Summarization Route
router.post('/analyze', upload.single('file'), analyzeDocument);

// MongoDB Document History Routes
router.get('/documents', getDocuments);
router.get('/documents/:id', getDocumentById);
router.delete('/documents/:id', deleteDocument);

// Health check
router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Document Summary Assistant API' }));

export default router;
