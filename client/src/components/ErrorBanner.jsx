import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export function ErrorBanner({ message, onReset }) {
  return (
    <div className="error-card">
      <AlertCircle size={32} style={{ color: 'var(--danger-text)', margin: '0 auto 0.75rem auto' }} />
      <h3 className="error-title">Unable to Process Document</h3>
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
