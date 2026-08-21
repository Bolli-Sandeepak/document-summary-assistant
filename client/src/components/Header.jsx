import React from 'react';
import { FileText, Sun, Moon } from 'lucide-react';

export function Header({ theme, onToggleTheme }) {
  return (
    <header className="site-header">
      <div className="brand-section">
        <div className="brand-icon">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="brand-title">Document Summary Assistant</h1>
          <p className="brand-subtitle">Professional document analysis & key insights</p>
        </div>
      </div>
      
      <button 
        className="theme-toggle-btn" 
        onClick={onToggleTheme}
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
