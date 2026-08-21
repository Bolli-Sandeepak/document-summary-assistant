import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ProcessingView } from './components/ProcessingView';
import { ResultsView } from './components/ResultsView';
import { ErrorBanner } from './components/ErrorBanner';
import { Toast } from './components/Toast';
import { uploadAndAnalyzeDocument, getDocuments, getDocumentById, deleteDocument } from './services/api';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('doc_assistant_theme') || 'dark');
  const [step, setStep] = useState('idle');       // idle | processing | results | error
  const [selectedFile, setSelectedFile] = useState(null);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // MongoDB History state
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Live progress from SSE
  const [liveMessage, setLiveMessage] = useState('');
  const [ocrProgress, setOcrProgress] = useState(null); // { current, total }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('doc_assistant_theme', theme);
  }, [theme]);

  // Load history list on idle step
  useEffect(() => {
    if (step === 'idle') {
      fetchHistory();
    }
  }, [step]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getDocuments();
      setHistory(data);
    } catch (err) {
      console.warn('[Database] MONGODB_URI not configured or offline:', err.message);
      setHistory([]); // Silent ignore if DB is not enabled
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadHistoryItem = async (id) => {
    setStep('processing');
    setLiveMessage('Loading saved document analysis...');
    try {
      const data = await getDocumentById(id);
      setResults(data);
      setStep('results');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load document analysis.');
      setStep('error');
    }
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation(); // Avoid triggering open card
    try {
      await deleteDocument(id);
      showToast('Document summary deleted.');
      fetchHistory();
    } catch (err) {
      showToast('Failed to delete summary.');
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setErrorMessage('');
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setErrorMessage('');
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setStep('processing');
    setLiveMessage('');
    setOcrProgress(null);
    setErrorMessage('');

    const handleProgress = (event) => {
      if (event.message) setLiveMessage(event.message);
      if (event.step === 'ocr_page' && event.current && event.total) {
        setOcrProgress({ current: event.current, total: event.total });
      }
    };

    try {
      const data = await uploadAndAnalyzeDocument(selectedFile, handleProgress);
      setResults(data);
      setStep('results');
    } catch (err) {
      console.error('[App] Analysis error:', err);
      setErrorMessage(err.message || 'Failed to process the document. Please try again.');
      setStep('error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResults(null);
    setErrorMessage('');
    setLiveMessage('');
    setOcrProgress(null);
    setStep('idle');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="app-container">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main style={{ flexGrow: 1 }}>
        {step === 'idle' && (
          <UploadZone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onClearFile={handleClearFile}
            onAnalyze={handleAnalyze}
            error={errorMessage}
            history={history}
            isLoadingHistory={isLoadingHistory}
            onLoadHistoryItem={handleLoadHistoryItem}
            onDeleteHistoryItem={handleDeleteHistoryItem}
          />
        )}

        {step === 'processing' && (
          <ProcessingView
            filename={selectedFile?.name || 'Document'}
            liveMessage={liveMessage}
            ocrProgress={ocrProgress}
          />
        )}

        {step === 'results' && results && (
          <ResultsView
            results={results}
            onReset={handleReset}
            onShowToast={showToast}
          />
        )}

        {step === 'error' && (
          <ErrorBanner message={errorMessage} onReset={handleReset} />
        )}
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}
