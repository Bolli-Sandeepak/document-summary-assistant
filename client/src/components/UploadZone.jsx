import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, ArrowRight, AlertCircle, History, Trash2, File } from 'lucide-react';

export function UploadZone({ 
  onFileSelect, 
  selectedFile, 
  onClearFile, 
  onAnalyze, 
  error,
  history = [],
  isLoadingHistory = false,
  onLoadHistoryItem,
  onDeleteHistoryItem
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  const validateAndSetFile = (file) => {
    setValidationError('');
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');

    if (!isPdf && !isImage) {
      setValidationError('Unsupported format. Please upload a PDF, PNG, JPG, or JPEG document.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setValidationError('File size exceeds 15MB limit. Please select a smaller document.');
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="page-intro">
        <h2 className="page-title">Document Summary Assistant</h2>
        <p className="page-description">
          Upload a document to generate a clear summary, key points, and important terms.
        </p>
      </div>

      <div className="upload-card">
        {!selectedFile ? (
          <>
            <div 
              className={`dropzone ${isDragOver ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon">
                <UploadCloud size={32} />
              </div>
              <h3 className="dropzone-title">Drag & drop your PDF or image here</h3>
              <p className="dropzone-hint">Supported format: PDF, PNG, JPG (up to 15MB)</p>
              
              <button type="button" className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <File size={15} />
                <span>Browse Files</span>
              </button>
            </div>

            {(validationError || error) && (
              <div className="error-card" style={{ marginTop: '1.25rem', padding: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                  <AlertCircle size={16} />
                  <span>{validationError || error}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="selected-file-box">
              <div className="file-info">
                {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                  <FileText size={22} style={{ color: 'var(--accent-primary)' }} />
                ) : (
                  <ImageIcon size={22} style={{ color: 'var(--accent-primary)' }} />
                )}
                <div>
                  <div className="file-name">{selectedFile.name}</div>
                  <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                </div>
              </div>

              <button 
                type="button" 
                className="remove-file-btn" 
                onClick={onClearFile}
                title="Remove File"
              >
                <X size={18} />
              </button>
            </div>

            <button 
              type="button" 
              className="action-btn-primary" 
              onClick={onAnalyze}
            >
              <span>Analyze Document</span>
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && !selectedFile && (
        <div className="history-section">
          <h3 className="section-title">
            <History size={17} style={{ color: 'var(--accent-primary)' }} />
            <span>Recent Document Summaries</span>
          </h3>

          <div className="history-grid">
            {history.map((doc) => (
              <div
                key={doc._id}
                onClick={() => onLoadHistoryItem(doc._id)}
                className="history-card"
              >
                <div>
                  <div className="history-title">{doc.filename}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {doc.wordCount} words • {doc.pages || 1} page(s) • {doc.extractionMethod}
                  </div>
                </div>

                <div className="history-meta">
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={(e) => onDeleteHistoryItem(e, doc._id)}
                    title="Delete Summary"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
