import React, { useState } from 'react';
import PianoTutor from './piano';
import { SessionSummary, SessionSummaryType } from './SessionSummary';
import { LandingPage } from './LandingPage';
import { SetupPage, SetupConfig } from './SetupPage';
import { AvatarProvider, useAvatar } from './AvatarContext';

type AppPage = 'landing' | 'setup' | 'piano' | 'summary';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>('landing');
  const [sessionData, setSessionData] = useState<SessionSummaryType | null>(null);
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null);
  const { setSelectedAvatar } = useAvatar();

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

  const handleStartPlaying = () => {
    setCurrentPage('setup');
  };

  const handleSetupComplete = (config: SetupConfig) => {
    setSetupConfig(config);
    setSelectedAvatar(config.selectedAvatar);
    setCurrentPage('piano');
  };

  const handleSetupBack = () => {
    setCurrentPage('landing');
  };

  const handleEndSession = (sessionData: SessionSummaryType) => {
    setSessionData(sessionData);
    setCurrentPage('summary');
  };

  const handleBackToHome = () => {
    setCurrentPage('landing');
    setSessionData(null);
    setSetupConfig(null);
  };

  const handleNewSession = () => {
    setCurrentPage('piano');
    setSessionData(null);
  };

  if (currentPage === 'landing') {
    return (
      <LandingPage onStartPlaying={handleStartPlaying} />
    );
  }

  if (currentPage === 'setup') {
    return (
      <SetupPage 
        onComplete={handleSetupComplete}
        onBack={handleSetupBack}
      />
    );
  }

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

const App: React.FC = () => {
  return (
    <AvatarProvider>
      <AppContent />
    </AvatarProvider>
  );
};

export default App;
