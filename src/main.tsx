import React from 'react';
import ReactDOM from 'react-dom/client';
import GeminiLiveInteracter from './liveapi';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <GeminiLiveInteracter />
  </React.StrictMode>
);
