import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * ProcessingView — shows animated progress stages during document analysis.
 * Uses simulated progress stages from the API client.
 */
export function ProcessingView({ filename, liveMessage, ocrProgress }) {
  const allSteps = [
    { key: 'uploading', label: 'Uploading document' },
    { key: 'extracting', label: 'Extracting text' },
    { key: 'analyzing', label: 'Analyzing content' },
    { key: 'summarizing', label: 'Generating summary' },
    { key: 'organizing', label: 'Organizing key points' },
  ];

  // Derive current step from liveMessage
  const getStepFromMessage = (msg = '') => {
    const m = msg.toLowerCase();
    if (m.includes('organizing') || m.includes('key points')) return 'organizing';
    if (m.includes('summary') || m.includes('summariz')) return 'summarizing';
    if (m.includes('analyz')) return 'analyzing';
    if (m.includes('extract') || m.includes('processing text') || m.includes('reading document')) return 'extracting';
    if (m.includes('upload')) return 'uploading';
    if (m.includes('complete')) return 'complete';
    return 'uploading';
  };

  const currentStep = getStepFromMessage(liveMessage);
  const currentIndex = allSteps.findIndex(s => s.key === currentStep);

  // Track highest reached step to prevent backward jumps
  const [maxIndex, setMaxIndex] = useState(0);

  useEffect(() => {
    const idx = currentIndex >= 0 ? currentIndex : 0;
    if (idx > maxIndex) {
      setMaxIndex(idx);
    }
  }, [currentIndex, maxIndex]);

  const activeIndex = Math.max(currentIndex >= 0 ? currentIndex : 0, maxIndex);

  const stepStatus = (idx) => {
    if (idx < activeIndex) return 'completed';
    if (idx === activeIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="processing-card">
      <h3 className="processing-header">
        Processing &ldquo;{filename}&rdquo;
      </h3>

      <div className="progress-checklist">
        <div className="checklist-item completed">
          <div className="item-status-icon">
            <Check size={13} />
          </div>
          <span>Document received</span>
        </div>

        {allSteps.map((step, idx) => {
          const status = stepStatus(idx);
          return (
            <div key={step.key} className={`checklist-item ${status}`}>
              <div className="item-status-icon">
                {status === 'completed' && <Check size={13} />}
                {status === 'active' && (
                  <Loader2 size={13} style={{ animation: 'spin 1.4s linear infinite' }} />
                )}
                {status === 'pending' && <span style={{ fontSize: '0.65rem' }}>○</span>}
              </div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      <p style={{ 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)', 
        textAlign: 'center', 
        marginTop: '1.5rem',
        fontStyle: 'italic'
      }}>
        This may take 15–60 seconds depending on document size...
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
