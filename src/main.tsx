import React from 'react';
import ReactDOM from 'react-dom/client';
import GeminiLiveVideoInteracter from './video';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <GeminiLiveVideoInteracter />
  </React.StrictMode>
);
