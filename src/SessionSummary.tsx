import React from 'react';
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { 
  Trophy, 
  TrendingUp, 
  Clock, 
  Target, 
  Download,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Home
} from "lucide-react";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface SessionSummaryType {
  duration: number;
  accuracy: number;
  notesPlayed: number;
  mistakes: Array<{
    finger: string;
    timestamp: number;
    note: string;
  }>;
}

interface SessionSummaryProps {
  summary: SessionSummaryType;
  onBackToHome: () => void;
  onNewSession: () => void;
}

export function SessionSummary({ summary, onBackToHome, onNewSession }: SessionSummaryProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Process mistakes for heatmap
  const fingerData = summary.mistakes.reduce((acc, mistake) => {
    acc[mistake.finger] = (acc[mistake.finger] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(fingerData).map(([finger, count]) => ({
    finger: finger.charAt(0).toUpperCase() + finger.slice(1),
    mistakes: count
  }));

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

  const getPerformanceLevel = (accuracy: number) => {
    if (accuracy >= 90) return { text: "Excellent!", color: "text-green-500", icon: "🌟" };
    if (accuracy >= 75) return { text: "Good Progress", color: "text-blue-500", icon: "👍" };
    if (accuracy >= 60) return { text: "Keep Practicing", color: "text-yellow-500", icon: "💪" };
    return { text: "More Practice Needed", color: "text-orange-500", icon: "📚" };
  };

  const performance = getPerformanceLevel(summary.accuracy);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4 border-2 border-white/30 backdrop-blur">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Trophy className="w-12 h-12 text-yellow-400" />
            Session Complete!
          </h1>
          <p className="text-purple-300 text-lg">
            Great work! Here's how you performed.
          </p>
        </motion.div>

        {/* Performance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-6 shadow-2xl border border-white/20">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-purple-300 mb-1">Duration</p>
                <p className="text-2xl text-white">{formatTime(summary.duration)}</p>
              </div>
              <div className="text-center">
                <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-purple-300 mb-1">Accuracy</p>
                <p className="text-2xl text-white">{summary.accuracy}%</p>
              </div>
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-purple-300 mb-1">Notes Played</p>
                <p className="text-2xl text-white">{summary.notesPlayed}</p>
              </div>
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-purple-300 mb-1">Corrections</p>
                <p className="text-2xl text-white">{summary.mistakes.length}</p>
              </div>
            </div>

            <div className="w-full h-px bg-white/20 my-6"></div>

            <div className="text-center">
              <p className="text-sm text-purple-300 mb-2">Performance Level</p>
              <div className={`text-3xl mb-2 ${performance.color}`}>
                {performance.icon} {performance.text}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Mistake Analysis */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 h-full">
              <h2 className="mb-4 text-white text-xl font-semibold">Finger Error Analysis</h2>
              {chartData.length > 0 ? (
                <>
                  <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 55, 0.1)" />
                        <XAxis 
                          dataKey="finger" 
                          stroke="#a8aec1"
                          tick={{ fill: '#a8aec1' }}
                        />
                        <YAxis 
                          stroke="#a8aec1"
                          tick={{ fill: '#a8aec1' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a2347', 
                            border: '1px solid rgba(212, 175, 55, 0.2)',
                            borderRadius: '0.5rem',
                            color: '#f5f5eb'
                          }}
                        />
                        <Bar dataKey="mistakes" radius={[8, 8, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={['#d4af37', '#4a7fbd', '#8b7fb8', '#5fa3d0', '#c4a962'][index % 5]} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-sm text-purple-300">
                    Focus on practicing with the fingers that had the most errors.
                  </p>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-purple-300">Perfect session! No errors detected.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Personalized Drills */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 h-full">
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
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm text-white font-medium">{drill.title}</h3>
                      <div className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded text-xs">
                        {drill.difficulty}
                      </div>
                    </div>
                    <p className="text-sm text-purple-300 mb-2">{drill.description}</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-purple-300">{drill.duration}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Export Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-6 mt-6 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20">
            <h2 className="mb-4 text-white text-xl font-semibold">Export Your Practice Plan</h2>
            <p className="text-purple-300 mb-4">
              Save your recommended drills and never forget to practice!
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-all flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-all flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email to Me
              </button>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-all flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Add to Calendar
              </button>
            </div>
          </div>
        </motion.div>

        {/* Motivation & Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="p-8 mt-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 text-center">
            <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="mb-3 text-white text-2xl font-semibold">Keep the Momentum Going!</h2>
            <p className="text-purple-300 mb-6 max-w-2xl mx-auto">
              Your AI tutor will remind you tomorrow if you skip practice. Consistency is key to mastering the piano!
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button 
                onClick={onNewSession}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
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

        {/* Achievement Badge */}
        {summary.accuracy >= 90 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
            className="mt-6"
          >
            <div className="p-6 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-xl shadow-2xl border border-yellow-400/40 text-center">
              <div className="inline-flex items-center gap-3">
                <Trophy className="w-8 h-8 text-yellow-400" />
                <div className="text-left">
                  <h3 className="text-white font-semibold">Achievement Unlocked!</h3>
                  <p className="text-sm text-purple-300">Perfect Practice Session - 90%+ Accuracy</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
