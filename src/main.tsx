import React from 'react';
import ReactDOM from 'react-dom/client';
import PianoTutor1 from './newpiano';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <PianoTutor1 />
  </React.StrictMode>
);
