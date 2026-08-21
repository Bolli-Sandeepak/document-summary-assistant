import React, { useEffect, useState } from 'react';
import { Check, Loader2, FileText } from 'lucide-react';

/**
 * ProcessingView — shows live progress events streamed from the server.
 * `liveMessage` is the latest message string forwarded by App.jsx from the SSE stream.
 * `ocrProgress` carries { current, total } when page-by-page OCR is running.
 */
export function ProcessingView({ filename, liveMessage, ocrProgress }) {
  const stageOrder = ['checking', 'extracting', 'ocr_detect', 'ocr_pages', 'summarizing', 'organizing'];

  // Derive stage from liveMessage
  const getStageFromMessage = (msg = '') => {
    const m = msg.toLowerCase();
    if (m.includes('checking')) return 'checking';
    if (m.includes('scanned') || m.includes('analyzing pages') || m.includes('require ocr')) return 'ocr_detect';
    if (m.includes('page') && (m.includes('reading') || m.includes('extracting text from page') || m.includes('ocr'))) return 'ocr_pages';
    if (m.includes('preparing summary') || m.includes('summary')) return 'summarizing';
    if (m.includes('organizing') || m.includes('key points')) return 'organizing';
    if (m.includes('extracting')) return 'extracting';
    return 'checking';
  };

  const calculatedStage = getStageFromMessage(liveMessage);
  const calculatedIndex = stageOrder.indexOf(calculatedStage);

  // Maintain highest achieved stage index to prevent backward UI state jumps
  const [maxStageIndex, setMaxStageIndex] = useState(0);

  useEffect(() => {
    if (calculatedIndex > maxStageIndex) {
      setMaxStageIndex(calculatedIndex);
    }
  }, [calculatedIndex, maxStageIndex]);

  const currentStageIndex = Math.max(calculatedIndex, maxStageIndex);
  const currentStage = stageOrder[currentStageIndex] || 'checking';

  // If OCR stage was encountered, keep showing OCR steps
  const [showOcrSteps, setShowOcrSteps] = useState(false);
  useEffect(() => {
    if (currentStage === 'ocr_detect' || currentStage === 'ocr_pages' || showOcrSteps) {
      setShowOcrSteps(true);
    }
  }, [currentStage, showOcrSteps]);

  const baseSteps = [
    { key: 'checking', label: 'Checking document' },
    { key: 'extracting', label: 'Extracting text' },
  ];

  const ocrSteps = showOcrSteps ? [
    { key: 'ocr_detect', label: 'Scanned content detected' },
    { key: 'ocr_pages', label: ocrProgress ? `Reading page ${ocrProgress.current} of ${ocrProgress.total}` : 'Reading pages...' },
  ] : [];

  const endSteps = [
    { key: 'summarizing', label: 'Preparing summary' },
    { key: 'organizing', label: 'Organizing key points' },
  ];

  const steps = [...baseSteps, ...ocrSteps, ...endSteps];

  const stepStatus = (key) => {
    const keyIndex = stageOrder.indexOf(key);
    if (keyIndex < currentStageIndex) return 'completed';
    if (keyIndex === currentStageIndex) return 'active';
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

        {steps.map((step) => {
          const status = stepStatus(step.key);
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
