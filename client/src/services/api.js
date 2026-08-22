/**
 * API client for Document Summary Assistant.
 * Uses standard JSON fetch (no SSE streaming) for Vercel serverless compatibility.
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

/**
 * Upload a document and get analysis results.
 * 
 * @param {File} file - The file to upload
 * @param {(event: object) => void} onProgress - Called for simulated progress events
 * @returns {Promise<object>} Analysis result
 */
export async function uploadAndAnalyzeDocument(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  // Start simulated progress
  const progressStages = [
    { message: 'Uploading document...', step: 'uploading', delay: 0 },
    { message: 'Extracting text from document...', step: 'extracting', delay: 2000 },
    { message: 'Analyzing content...', step: 'analyzing', delay: 6000 },
    { message: 'Generating summary...', step: 'summarizing', delay: 12000 },
    { message: 'Organizing key points...', step: 'organizing', delay: 20000 },
  ];

  const progressTimers = [];
  for (const stage of progressStages) {
    const timer = setTimeout(() => {
      onProgress?.({ message: stage.message, step: stage.step });
    }, stage.delay);
    progressTimers.push(timer);
  }

  const clearProgressTimers = () => {
    progressTimers.forEach(t => clearTimeout(t));
  };

  const controller = new AbortController();
  // Overall timeout: 3 minutes for large documents
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      // Do NOT set Content-Type manually — let the browser set it with the correct boundary
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    clearProgressTimers();

    if (networkErr.name === 'AbortError') {
      throw new Error('Document processing timed out after 3 minutes. Please try with a smaller file.');
    }

    // Distinguish CORS errors from general network errors
    if (networkErr.message?.includes('Failed to fetch') || networkErr.message?.includes('NetworkError')) {
      throw new Error('Cannot connect to the server. The backend service may be starting up — please wait a moment and try again.');
    }

    throw new Error('Network error: Unable to reach the server. Please check your internet connection and try again.');
  }

  clearTimeout(timeoutId);
  clearProgressTimers();

  // Handle non-OK responses
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      throw new Error(`Server error (${response.status}): ${text || 'Please try again.'}`);
    }

    // Map error types to user-friendly messages
    const errorType = errorData.errorType || '';
    const serverMessage = errorData.error || 'An error occurred while processing your document.';

    switch (errorType) {
      case 'NO_FILE':
        throw new Error('No file was received by the server. Please select a file and try again.');
      case 'UNSUPPORTED_FORMAT':
        throw new Error(serverMessage);
      case 'FILE_TOO_LARGE':
        throw new Error('The file is too large. Please upload a document smaller than 15MB.');
      case 'EXTRACTION_FAILED':
        throw new Error(serverMessage);
      case 'OCR_FAILED':
        throw new Error(serverMessage);
      case 'INVALID_PDF':
        throw new Error('The PDF file appears to be corrupted or password-protected. Please try a different file.');
      case 'TIMEOUT':
        throw new Error('Processing took too long. Please try a smaller or simpler document.');
      case 'AI_API_ERROR':
        throw new Error('The AI summarization service is temporarily unavailable. The system will use a local summarizer — please try again.');
      default:
        throw new Error(serverMessage);
    }
  }

  // Parse JSON response
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from server. Please try again.');
  }

  if (!data.success) {
    throw new Error(data.error || 'Document processing failed. Please try again.');
  }

  // Signal completion
  onProgress?.({ message: 'Analysis complete!', step: 'complete' });

  return data;
}

/**
 * Fetch all recently summarized documents metadata
 */
export async function getDocuments() {
  const response = await fetch(`${API_BASE_URL}/api/documents`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch document history.');
  }
  return data.data;
}

/**
 * Fetch detailed content of a specific summary by ID
 */
export async function getDocumentById(id) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch document details.');
  }
  return data.data;
}

/**
 * Delete a summary by ID
 */
export async function deleteDocument(id) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: 'DELETE'
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete document summary.');
  }
  return data;
}
