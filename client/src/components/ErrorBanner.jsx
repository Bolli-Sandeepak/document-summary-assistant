import React from 'react';
import { AlertCircle, RotateCcw, WifiOff, FileX, Clock, ServerCrash } from 'lucide-react';

/**
 * Categorize error messages to show appropriate icons and styling.
 */
function getErrorCategory(message) {
  const msg = (message || '').toLowerCase();
  
  if (msg.includes('cannot connect') || msg.includes('cannot reach') || msg.includes('network error') || msg.includes('failed to fetch')) {
    return { icon: WifiOff, title: 'Connection Error', color: 'var(--danger-text)' };
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('took too long')) {
    return { icon: Clock, title: 'Processing Timeout', color: 'var(--warning-text, var(--danger-text))' };
  }
  if (msg.includes('unsupported') || msg.includes('invalid') || msg.includes('corrupted') || msg.includes('format')) {
    return { icon: FileX, title: 'Invalid Document', color: 'var(--danger-text)' };
  }
  if (msg.includes('extract') || msg.includes('scanned') || msg.includes('ocr') || msg.includes('image-based')) {
    return { icon: FileX, title: 'Extraction Problem', color: 'var(--danger-text)' };
  }
  if (msg.includes('server') || msg.includes('api') || msg.includes('502') || msg.includes('503')) {
    return { icon: ServerCrash, title: 'Server Error', color: 'var(--danger-text)' };
  }
  return { icon: AlertCircle, title: 'Unable to Process Document', color: 'var(--danger-text)' };
}

export function ErrorBanner({ message, onReset }) {
  const { icon: Icon, title } = getErrorCategory(message);

  return (
    <div className="error-card">
      <Icon size={32} style={{ color: 'var(--danger-text)', margin: '0 auto 0.75rem auto' }} />
      <h3 className="error-title">{title}</h3>
      <p className="error-desc">{message || 'An unexpected error occurred while processing your document.'}</p>
      
      <button 
        type="button" 
        className="action-btn-primary" 
        style={{ width: 'auto', margin: '0 auto', padding: '0.5rem 1.25rem' }} 
        onClick={onReset}
      >
        <RotateCcw size={15} />
        <span>Try Another Document</span>
      </button>
    </div>
  );
}
