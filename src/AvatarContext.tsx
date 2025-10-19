import React, { createContext, useContext, useState, ReactNode } from 'react';
import avatarData from '../avatars/avatar.json';

export interface Avatar {
  id: string;
  name: string;
  voice_id: string;
  system_prompt: string;
  avatar_url: string;
  personality: string;
  quote: string;
}

interface AvatarContextType {
  selectedAvatar: Avatar | null;
  setSelectedAvatar: (avatarId: string) => void;
  getAvatarById: (id: string) => Avatar | null;
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export const useAvatar = () => {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }
  return context;
};

interface AvatarProviderProps {
  children: ReactNode;
}

export const AvatarProvider: React.FC<AvatarProviderProps> = ({ children }) => {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');

  const setSelectedAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
  };

  const getAvatarById = (id: string): Avatar | null => {
    return avatarData.find(avatar => avatar.id === id) || null;
  };

  const selectedAvatar = selectedAvatarId ? getAvatarById(selectedAvatarId) : null;

  const value = {
    selectedAvatar,
    setSelectedAvatar,
    getAvatarById,
  };

  return (
    <AvatarContext.Provider value={value}>
      {children}
    </AvatarContext.Provider>
  );
};

