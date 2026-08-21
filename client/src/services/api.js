/**
 * API client — streams SSE progress events from POST /api/analyze.
 *
 * @param {File} file - The file to upload
 * @param {(event: object) => void} onProgress - Called for each progress event
 * @returns {Promise<object>} Final analysis result on completion
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

export async function uploadAndAnalyzeDocument(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const controller = new AbortController();
  // Hard limit 3 minutes overall
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    if (networkErr.name === 'AbortError') {
      throw new Error('Document processing timed out after 3 minutes. Please try again with a smaller file or clearer text.');
    }
    throw new Error('Cannot reach the server. Please ensure the backend is running and try again.');
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const msg = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status}): ${msg || 'Please check the file and try again.'}`);
  }

  // Read the SSE stream via fetch ReadableStream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const readPromise = reader.read();
      // 120-second read stall timeout
      const stallPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('StallTimeout')), 120000)
      );

      let chunk;
      try {
        chunk = await Promise.race([readPromise, stallPromise]);
      } catch (err) {
        if (err.message === 'StallTimeout') {
          reader.cancel().catch(() => {});
          throw new Error('Processing connection stalled. Please try uploading again.');
        }
        throw err;
      }

      const { done, value } = chunk;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep the incomplete trailing chunk

      for (const part of parts) {
        if (part.trim().startsWith(':')) continue; // skip SSE keep-alive comments

        const dataLine = part.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;

        let event;
        try {
          event = JSON.parse(dataLine.slice(6)); // strip "data: "
        } catch {
          continue;
        }

        if (event.type === 'complete') {
          clearTimeout(timeoutId);
          return event;
        }

        if (event.type === 'error') {
          clearTimeout(timeoutId);
          throw new Error(event.message || 'Document processing failed.');
        }

        if (event.type === 'progress' && onProgress) {
          onProgress(event);
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  throw new Error('Server connection was reset during processing. Render free instances sleep after inactivity — please click "Try Another Document" to retry now that the server is awake!');
}

/**
 * Fetch all recently summarized documents metadata
 */
export async function getDocuments() {
  const response = await fetch(`${API_BASE_URL}/api/documents`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch document history');
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
    throw new Error(data.error || 'Failed to fetch document details');
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
    throw new Error(data.error || 'Failed to delete document summary');
  }
  return data;
}
