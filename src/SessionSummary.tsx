import React, { useState, useRef, useEffect } from 'react';
import { Button } from "./ui/button";
import { 
  TrendingUp, 
  Clock, 
  Home,
  Music,
  Play,
  Pause,
  Volume2
} from "lucide-react";
import { motion } from "motion/react";
import { AIChatBubble } from "./AIChatBubble";
import { useAvatar } from './AvatarContext';
import { ImageWithFallback } from './figma/ImageWithFallback';

export interface SessionSummaryType {
  duration: number;
  accuracy: number;
  notesPlayed: number;
  mistakes: Array<{
    finger: string;
    timestamp: number;
    note: string;
  }>;
  conversationSummary?: string;
  summaryAvatar?: {
    id: string;
    name: string;
    avatar_url: string;
    video_url: string;
    voice_id: string;
    personality: string;
    quote: string;
  };
  summaryAudioUrl?: string;
}

interface SessionSummaryProps {
  summary: SessionSummaryType;
  onBackToHome: () => void;
  onNewSession: () => void;
}

export function SessionSummary({ summary, onBackToHome, onNewSession }: SessionSummaryProps) {
  const { selectedAvatar } = useAvatar();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play audio when component mounts and audio URL is available
  useEffect(() => {
    if (summary.summaryAudioUrl && !isPlayingAudio && !isLoadingAudio) {
      handleAutoPlayAudio();
    }
  }, [summary.summaryAudioUrl]);

  const handleAutoPlayAudio = async () => {
    if (!summary.summaryAudioUrl) return;

    try {
      setIsLoadingAudio(true);
      setAudioError(null);

      const audio = new Audio(summary.summaryAudioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
      };

      audio.onerror = () => {
        setAudioError('Failed to play audio');
        setIsPlayingAudio(false);
        setIsLoadingAudio(false);
      };

      await audio.play();
      setIsPlayingAudio(true);
      setIsLoadingAudio(false);
      console.log('🎵 Auto-playing summary audio');
    } catch (error) {
      console.error('Error auto-playing audio:', error);
      setAudioError('Failed to play audio');
      setIsLoadingAudio(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateAudio = async (text: string, voiceId: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  };

  const handlePlayAudio = async () => {
    if (!summary.summaryAudioUrl) {
      setAudioError('No audio available');
      return;
    }

    if (isPlayingAudio) {
      // Pause current audio
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      }
      return;
    }

    try {
      setIsLoadingAudio(true);
      setAudioError(null);

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(summary.summaryAudioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
      };

      audio.onerror = () => {
        setAudioError('Failed to play audio');
        setIsPlayingAudio(false);
        setIsLoadingAudio(false);
      };

      await audio.play();
      setIsPlayingAudio(true);
      setIsLoadingAudio(false);
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioError('Failed to play audio');
      setIsLoadingAudio(false);
    }
  };


  // Generate practice drills based on mistakes
  const drills = [
    {
      title: "Finger Independence Exercise",
      description: "Practice scales using the fingers that made the most mistakes",
      duration: "10 min",
      difficulty: "Medium"
    },
    {
      title: "Slow Tempo Chord Practice",
      description: "Work on chord transitions at 60 BPM",
      duration: "15 min",
      difficulty: "Easy"
    },
    {
      title: "Hand Position Drills",
      description: "Focus on maintaining proper curved hand position",
      duration: "5 min",
      difficulty: "Easy"
    }
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            {selectedAvatar && (
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl">
                <ImageWithFallback
                  src={selectedAvatar.avatar_url}
                  alt={selectedAvatar.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full border-2 border-white/30 backdrop-blur">
              <Music className="w-10 h-10 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Music className="w-12 h-12 text-cyan-400" />
            Session Complete!
          </h1>
          <p className="text-slate-300 text-lg">
            {selectedAvatar ? `${selectedAvatar.name} says: Great work! Here's how you performed.` : 'Great work! Here\'s how you performed.'}
          </p>
        </motion.div>

        {/* Performance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-6 shadow-2xl border border-white/20">
            <div className="text-center">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300 mb-1">Session Duration</p>
              <p className="text-3xl text-white font-bold">{formatTime(summary.duration)}</p>
            </div>
          </div>
        </motion.div>

        {/* Conversation Summary */}
        {summary.conversationSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                {summary.summaryAvatar ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-400">
                    <ImageWithFallback
                      src={summary.summaryAvatar.avatar_url}
                      alt={summary.summaryAvatar.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">📝</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white">
                    Session Summary
                    {summary.summaryAvatar && (
                      <span className="text-sm font-normal text-cyan-300 ml-2">
                        by {summary.summaryAvatar.name}
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {summary.summaryAvatar ? summary.summaryAvatar.personality : 'AI-generated reflection on your lesson'}
                  </p>
                </div>
                {summary.summaryAudioUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayAudio}
                      disabled={isLoadingAudio}
                      className={`p-2 rounded-full transition-all ${
                        isPlayingAudio 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                      title={isPlayingAudio ? 'Pause audio' : 'Play audio summary'}
                    >
                      {isLoadingAudio ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : isPlayingAudio ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    {audioError && (
                      <span className="text-xs text-red-400">{audioError}</span>
                    )}
                  </div>
                )}
              </div>
              {summary.summaryAvatar?.video_url && (
                <motion.div 
                  className="mb-4 bg-black/30 rounded-lg overflow-hidden border border-white/10 relative"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <video
                    src={summary.summaryAvatar.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-70 object-contain transition-transform duration-300 hover:scale-105"
                    onError={(e) => {
                      // Fallback to image if video fails to load
                      const video = e.target as HTMLVideoElement;
                      const img = document.createElement('img');
                      img.src = summary.summaryAvatar?.avatar_url || '';
                      img.alt = summary.summaryAvatar?.name || 'Avatar';
                      img.className = 'w-full h-48 object-contain transition-transform duration-300 hover:scale-105';
                      video.parentNode?.replaceChild(img, video);
                    }}
                  />
                  <div className="absolute bottom-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
                    {summary.summaryAvatar.name}
                  </div>
                </motion.div>
              )}
              <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                  {summary.conversationSummary}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Personalized Drills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xl font-semibold">Recommended Drills</h2>
              <div className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-medium">
                AI Generated
              </div>
            </div>
            <div className="space-y-3">
              {drills.map((drill, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm text-white font-medium">{drill.title}</h3>
                    <div className="px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded text-xs">
                      {drill.difficulty}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{drill.description}</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-slate-300">{drill.duration}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>



        {/* Motivation & Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="p-8 mt-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 text-center">
            <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="mb-3 text-white text-2xl font-semibold">Keep the Momentum Going!</h2>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Your AI instructor will remind you tomorrow if you skip practice. Consistency is key to mastering your musical skills!
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button 
                onClick={onNewSession}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
              >
                Start Another Session
              </button>
              <button 
                onClick={onBackToHome}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-medium transition-all flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </button>
            </div>
          </div>
        </motion.div>


        {/* AI Chat Bubble */}
        <AIChatBubble summary={summary} />
      </div>
    </div>
  );
}
