export function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  // Handle Multer upload errors (e.g. file size exceeded)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size limit exceeded. Please upload a document smaller than 15MB.'
    });
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  return res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred while processing your document.'
  });
}
