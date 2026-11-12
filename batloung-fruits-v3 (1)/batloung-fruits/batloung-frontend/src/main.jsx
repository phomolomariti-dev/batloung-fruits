import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConsentProvider } from './utils/consent';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConsentProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConsentProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
