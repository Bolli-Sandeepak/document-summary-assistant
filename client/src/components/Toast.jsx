import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="toast-container" role="alert">
      <CheckCircle2 size={18} style={{ color: 'var(--success-text)' }} />
      <span>{message}</span>
    </div>
  );
}
