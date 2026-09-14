import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme-darkroom.css';
import './theme-editorial-monochrome.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
