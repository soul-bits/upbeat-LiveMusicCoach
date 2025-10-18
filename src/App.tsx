import React, { useState } from 'react';
import PianoTutor from './piano';
import { SessionSummary, SessionSummaryType } from './SessionSummary';

type AppPage = 'piano' | 'summary';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>('piano');
  const [sessionData, setSessionData] = useState<SessionSummaryType | null>(null);

  // Mock session data - in a real app, this would come from the piano session
  const generateMockSessionData = (): SessionSummaryType => {
    return {
      duration: Math.floor(Math.random() * 1800) + 300, // 5-35 minutes
      accuracy: Math.floor(Math.random() * 40) + 60, // 60-100%
      notesPlayed: Math.floor(Math.random() * 200) + 50, // 50-250 notes
      mistakes: [
        { finger: 'thumb', timestamp: 120, note: 'C' },
        { finger: 'index', timestamp: 180, note: 'D' },
        { finger: 'middle', timestamp: 240, note: 'E' },
        { finger: 'ring', timestamp: 300, note: 'F' },
        { finger: 'pinky', timestamp: 360, note: 'G' },
      ].filter(() => Math.random() > 0.3) // Randomly include some mistakes
    };
  };

  const handleEndSession = (sessionData: SessionSummaryType) => {
    setSessionData(sessionData);
    setCurrentPage('summary');
  };

  const handleBackToHome = () => {
    setCurrentPage('piano');
    setSessionData(null);
  };

  const handleNewSession = () => {
    setCurrentPage('piano');
    setSessionData(null);
  };

  if (currentPage === 'summary' && sessionData) {
    return (
      <SessionSummary
        summary={sessionData}
        onBackToHome={handleBackToHome}
        onNewSession={handleNewSession}
      />
    );
  }

  return (
    <PianoTutor onEndSession={handleEndSession} />
  );
};

export default App;
