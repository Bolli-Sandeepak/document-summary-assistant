export function errorHandler(err, req, res, next) {
  console.error('[API Error]', err.message || err);

  // Handle Multer upload errors (e.g. file size exceeded)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      errorType: 'FILE_TOO_LARGE',
      error: 'File size limit exceeded. Please upload a document smaller than 15MB.'
    });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      errorType: 'INVALID_UPLOAD',
      error: 'Invalid file upload. Please upload a single PDF, JPG, or PNG file.'
    });
  }

  // Multer general error
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      errorType: 'UPLOAD_ERROR',
      error: err.message || 'File upload failed. Please try again.'
    });
  }

  // Custom validation errors
  if (err.message && err.message.includes('Invalid file format')) {
    return res.status(415).json({
      success: false,
      errorType: 'UNSUPPORTED_FORMAT',
      error: err.message
    });
  }

  // Timeout errors
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      errorType: 'TIMEOUT',
      error: 'Processing took too long. Please try a smaller or simpler document.'
    });
  }

  // Default server error — don't expose internal details in production
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    errorType: 'SERVER_ERROR',
    error: isProduction
      ? 'An unexpected error occurred while processing your document. Please try again.'
      : (err.message || 'An unexpected error occurred.')
  });
}
