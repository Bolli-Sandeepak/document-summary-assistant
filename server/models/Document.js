import mongoose from 'mongoose';

const KeyPointSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String
});

const ImportantTermSchema = new mongoose.Schema({
  term: String,
  explanation: String
});

const SuggestionSchema = new mongoose.Schema({
  category: String,
  title: String,
  detail: String
});

const DocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  fileSize: Number,
  mimeType: String,
  wordCount: Number,
  charCount: Number,
  pages: Number,
  extractionMethod: String,
  ocrConfidence: Number,
  isScannedPdf: Boolean,
  extractedText: {
    type: String,
    required: true
  },
  summaries: {
    short: String,
    medium: String,
    long: String
  },
  keyPoints: [KeyPointSchema],
  importantTerms: [ImportantTermSchema],
  improvementSuggestions: [SuggestionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Document', DocumentSchema);
