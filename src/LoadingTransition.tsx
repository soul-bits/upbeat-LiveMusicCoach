import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Music, Flame } from "lucide-react";
import { ImageWithFallback } from './figma/ImageWithFallback';

interface LoadingTransitionProps {
  progress: string;
  avatar?: {
    id: string;
    name: string;
    avatar_url: string;
    personality: string;
    quote: string;
  };
}

export function LoadingTransition({ progress, avatar }: LoadingTransitionProps) {
  const [streak, setStreak] = useState(0);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);

  // Load streak from localStorage and show celebration when ending session
  useEffect(() => {
    const savedStreak = localStorage.getItem('practiceStreak');
    const lastPracticeDate = localStorage.getItem('lastPracticeDate');
    const today = new Date().toDateString();
    
    if (savedStreak) {
      const currentStreak = parseInt(savedStreak);
      setStreak(currentStreak);
      
      // Show celebration when ending a session (loading page appears)
      // This means they just completed a practice session
      if (currentStreak > 0) {
        setShowStreakCelebration(true);
        // Hide celebration after 3 seconds
        setTimeout(() => {
          setShowStreakCelebration(false);
        }, 3000);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center">
        {/* Streak Celebration */}
        <AnimatePresence>
          {showStreakCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ 
                duration: 0.8, 
                type: "spring",
                bounce: 0.6
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-8 shadow-2xl border-4 border-orange-300 max-w-md mx-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.8 }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                    className="mb-4"
                  >
                    <Flame className="w-20 h-20 text-white mx-auto drop-shadow-lg" />
                  </motion.div>
                  
                  <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="text-3xl font-bold text-white mb-2"
                  >
                    Congratulations! 🎉
                  </motion.h1>
                  
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="text-xl text-orange-100 mb-4"
                  >
                    Day {streak} Streak!
                  </motion.p>
                  
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="text-orange-200"
                  >
                    {streak === 1 && "Great start! Keep the momentum going!"}
                    {streak > 1 && streak < 7 && "You're building an amazing habit!"}
                    {streak >= 7 && streak < 30 && "Incredible consistency! You're on fire!"}
                    {streak >= 30 && "You're a practice champion! Absolutely incredible!"}
                  </motion.p>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1, duration: 0.3 }}
                    className="mt-6 text-4xl"
                  >
                    {streak >= 7 && "🔥🔥"}
                    {streak >= 30 && "🔥🔥🔥"}
                    {streak < 7 && "🔥"}
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Avatar Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="mb-8"
        >
          {avatar ? (
            <div className="relative">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-cyan-400 shadow-2xl">
                <ImageWithFallback
                  src={avatar.avatar_url}
                  alt={avatar.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-cyan-600 px-4 py-1 rounded-full shadow-lg">
                <span className="text-white text-sm font-medium">{avatar.name}</span>
              </div>
            </div>
          ) : (
            <div className="w-32 h-32 mx-auto rounded-full bg-white/20 border-4 border-cyan-400 shadow-2xl flex items-center justify-center">
              <Music className="w-16 h-16 text-cyan-400" />
            </div>
          )}
        </motion.div>

        {/* Progress Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            {avatar ? `Hello, I am ${avatar.name}` : 'Preparing Your Session'}
          </h1>
          <p className="text-xl text-slate-300 mb-6">
            {avatar ? avatar.personality : 'Please wait while we process your lesson...'}
          </p>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-white/20"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-2xl text-white font-semibold">{progress}</span>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3 text-left">
            <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              progress.includes('Writing') || progress.includes('Preparing') || progress.includes('Complete') ? 'bg-cyan-500/20 border border-cyan-400/30' : 'bg-white/5'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                progress.includes('Writing') || progress.includes('Preparing') || progress.includes('Complete') ? 'bg-cyan-500' : 'bg-gray-500'
              }`}>
                {progress.includes('Writing') ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <span className="text-white text-xs">1</span>
                )}
              </div>
              <span className="text-white">
                {avatar ? `${avatar.name} is writing your summary...` : 'Writing your summary...'}
              </span>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              progress.includes('Preparing') || progress.includes('Complete') ? 'bg-cyan-500/20 border border-cyan-400/30' : 'bg-white/5'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                progress.includes('Preparing') || progress.includes('Complete') ? 'bg-cyan-500' : 'bg-gray-500'
              }`}>
                {progress.includes('Preparing') ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <span className="text-white text-xs">2</span>
                )}
              </div>
              <span className="text-white">Preparing audio...</span>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              progress.includes('Complete') ? 'bg-green-500/20 border border-green-400/30' : 'bg-white/5'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                progress.includes('Complete') ? 'bg-green-500' : 'bg-gray-500'
              }`}>
                {progress.includes('Complete') ? (
                  <span className="text-white text-xs">✓</span>
                ) : (
                  <span className="text-white text-xs">3</span>
                )}
              </div>
              <span className="text-white">Almost ready...</span>
            </div>
          </div>
        </motion.div>

        {/* Quote Display */}
        {avatar?.quote && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-cyan-400/30"
          >
            <p className="text-cyan-200 text-lg italic">"{avatar.quote}"</p>
            <p className="text-cyan-300 text-sm mt-2">- {avatar.name}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
