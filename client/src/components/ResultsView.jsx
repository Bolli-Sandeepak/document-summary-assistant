import React, { useState } from 'react';
import { 
  FileText, 
  RotateCcw, 
  Copy, 
  Download, 
  Check, 
  ListOrdered, 
  BookOpen, 
  FileCode,
  Sparkles,
  Lightbulb
} from 'lucide-react';

export function ResultsView({ results, onReset, onShowToast }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'keyPoints' | 'terms' | 'rawText'
  const [summaryLength, setSummaryLength] = useState('medium'); // 'short' | 'medium' | 'long'
  const [copiedSection, setCopiedSection] = useState(null);

  const { document, extractedText, summaries, keyPoints, importantTerms = [], improvementSuggestions = [] } = results;

  const currentSummaryText = summaries?.[summaryLength] || summaries?.medium || 'Summary unavailable.';

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    onShowToast(`${label} copied to clipboard.`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadTxt = () => {
    const content = `DOCUMENT SUMMARY REPORT
====================================
Document: ${document.filename}
Method: ${document.extractionMethod}
Pages: ${document.pages || 1}
Word Count: ${document.wordCount} words
Date: ${new Date().toLocaleDateString()}

====================================
SUMMARY (${summaryLength.toUpperCase()})
====================================
${currentSummaryText}

====================================
KEY POINTS
====================================
${keyPoints?.map(kp => `[${kp.id || '•'}] ${kp.title}\n${kp.description}`).join('\n\n') || 'N/A'}

====================================
IMPORTANT TERMS
====================================
${importantTerms?.map(t => `• ${t.term}: ${t.explanation}`).join('\n') || 'N/A'}

====================================
EXTRACTED TEXT
====================================
${extractedText}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.filename.replace(/\.[^/.]+$/, '')}_summary.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast('Summary downloaded as TXT file.');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="results-workspace">
      {/* Top Document Metadata Bar */}
      <div className="doc-meta-bar">
        <div className="doc-main-info">
          <FileText size={22} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--text-primary)' }}>
              {document.filename}
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {formatFileSize(document.fileSize)} • {document.pages || 1} page(s)
            </div>
          </div>
        </div>

        <div className="doc-badges">
          <span className="badge accent">{document.extractionMethod}</span>
          <span className="badge">{document.wordCount} words</span>
          {document.ocrConfidence && (
            <span className="badge" style={{ color: 'var(--success-text)' }}>
              {document.ocrConfidence}% OCR
            </span>
          )}
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="workspace-tabs" role="tablist">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
          role="tab"
        >
          <Sparkles size={16} />
          <span>Summary</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'keyPoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('keyPoints')}
          role="tab"
        >
          <ListOrdered size={16} />
          <span>Key Points ({keyPoints?.length || 0})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
          role="tab"
        >
          <BookOpen size={16} />
          <span>Important Terms ({importantTerms?.length || 0})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'rawText' ? 'active' : ''}`}
          onClick={() => setActiveTab('rawText')}
          role="tab"
        >
          <FileCode size={16} />
          <span>Extracted Text</span>
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="tab-content-panel">
        {activeTab === 'summary' && (
          <div>
            <div className="sub-summary-toggle">
              <button
                type="button"
                className={`sub-toggle-btn ${summaryLength === 'short' ? 'active' : ''}`}
                onClick={() => setSummaryLength('short')}
              >
                Short
              </button>
              <button
                type="button"
                className={`sub-toggle-btn ${summaryLength === 'medium' ? 'active' : ''}`}
                onClick={() => setSummaryLength('medium')}
              >
                Medium
              </button>
              <button
                type="button"
                className={`sub-toggle-btn ${summaryLength === 'long' ? 'active' : ''}`}
                onClick={() => setSummaryLength('long')}
              >
                Long
              </button>
            </div>

            <div className="summary-text-body">
              {currentSummaryText}
            </div>
          </div>
        )}

        {activeTab === 'keyPoints' && (
          <div className="cards-grid">
            {keyPoints?.map((kp, idx) => (
              <div key={idx} className="info-card">
                <div className="info-card-header">
                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {kp.id || `0${idx + 1}`}
                  </span>
                  <span>{kp.title}</span>
                </div>
                <div className="info-card-body">{kp.description}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="cards-grid">
            {importantTerms?.map((termObj, idx) => (
              <div key={idx} className="info-card">
                <div className="info-card-header" style={{ color: 'var(--accent-primary)' }}>
                  <BookOpen size={15} />
                  <span>{termObj.term}</span>
                </div>
                <div className="info-card-body">{termObj.explanation}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rawText' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing raw extracted text ({document.charCount} characters)
              </span>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleCopy(extractedText, 'Extracted Text')}
              >
                {copiedSection === 'Extracted Text' ? <Check size={14} /> : <Copy size={14} />}
                <span>Copy Raw Text</span>
              </button>
            </div>
            <pre className="raw-text-viewer">{extractedText}</pre>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="action-toolbar">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => handleCopy(currentSummaryText, 'Summary')}
        >
          {copiedSection === 'Summary' ? <Check size={14} /> : <Copy size={14} />}
          <span>Copy Summary</span>
        </button>

        <button
          type="button"
          className="secondary-btn"
          onClick={handleDownloadTxt}
        >
          <Download size={14} />
          <span>Download TXT</span>
        </button>

        <button
          type="button"
          className="action-btn-primary"
          style={{ width: 'auto', padding: '0.5rem 1.1rem' }}
          onClick={onReset}
        >
          <RotateCcw size={15} />
          <span>Upload Another Document</span>
        </button>
      </div>
    </div>
  );
}
