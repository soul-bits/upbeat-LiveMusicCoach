import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Check, ArrowRight, ArrowLeft, Star, Sparkles, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import avatarData from "../avatars/avatar.json";

interface SetupPageProps {
  onComplete: (config: SetupConfig) => void;
  onBack: () => void;
}

export interface SetupConfig {
  webcamEnabled: boolean;
  selectedAvatar: string;
}


export function SetupPage({ onComplete, onBack }: SetupPageProps) {
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleComplete = () => {
    onComplete({
      webcamEnabled: false, // Always false since we removed webcam setup
      selectedAvatar
    });
  };

  const isStepValid = () => {
    return selectedAvatar;
  };

  const nextAvatar = () => {
    setCurrentIndex((prev) => (prev + 1) % avatarData.length);
  };

  const prevAvatar = () => {
    setCurrentIndex((prev) => (prev - 1 + avatarData.length) % avatarData.length);
  };

  const goToAvatar = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        <div className="container mx-auto max-w-6xl">
          {/* Header Section */}
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button 
              variant="ghost" 
              onClick={onBack}
              className="mb-8 text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
            <div className="flex items-center justify-center mb-6">
              <Music className="w-8 h-8 text-yellow-400 mr-3" />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
                Choose Your AI Instructor
              </h1>
              <Sparkles className="w-8 h-8 text-yellow-400 ml-3" />
            </div>

            <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Each instructor has a unique personality and teaching style. Pick the one that resonates with your learning journey!
            </p>

            {/* Setup Status */}
            <div className="mt-8 flex items-center justify-center">
              <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
                <Music className="w-5 h-5 text-yellow-400" />
                <span className="text-slate-300 font-medium">Choose your instructor to get started</span>
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </motion.div>

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-8"
          >
            <h2 className="text-4xl font-bold text-white mb-4">Meet Your AI Instructors</h2>
            <p className="text-slate-300 text-lg">
              Swipe through to explore each instructor's unique teaching style
            </p>
          </motion.div>

          {/* Avatar Selection Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="p-6 sm:p-8 lg:p-12 bg-white/70 backdrop-blur-xl border-white/30 shadow-2xl relative overflow-hidden drop-shadow-2xl">
              {/* Blurred Background Avatar */}
              <div className="absolute inset-0 opacity-100 drop-shadow-2xl">
                <div 
                  className="w-full h-full bg-cover bg-top blur-lg bg-gradient-to-br from-teal-200 to-cyan-300 drop-shadow-2xl"
                  style={{
                    backgroundImage: `url(${avatarData[currentIndex].avatar_url})`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-white/30 drop-shadow-2xl"></div>
              </div>

              {/* Main Avatar Display */}
              <div className="relative mb-8 z-10 drop-shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="text-center"
                  >
                    {/* Large Avatar Image */}
                    <div className="relative mb-6">
                      <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-8 border-white shadow-2xl relative">
                        <ImageWithFallback
                          src={avatarData[currentIndex].avatar_url}
                          alt={avatarData[currentIndex].name}
                          className="w-full h-full object-cover"
                        />
                        {selectedAvatar === avatarData[currentIndex].id && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute inset-0 rounded-full border-8 border-teal-400 shadow-xl shadow-teal-400/70"
                          />
                        )}
                      </div>
                      
                      {/* Selection Indicator */}
                      {selectedAvatar === avatarData[currentIndex].id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full flex items-center justify-center shadow-xl border-3 border-white"
                        >
                          <Check className="w-6 h-6 text-white" />
                        </motion.div>
                      )}
                    </div>

                    {/* Tutor Information */}
                    <div className="max-w-md mx-auto">
                       <h3 className="text-3xl font-bold text-white mb-3 drop-shadow-2xl">
                         {avatarData[currentIndex].name}
                       </h3>
                      
                      <div className="mb-6">
                        <Badge 
                          variant="secondary" 
                          className="text-sm bg-gradient-to-r from-cyan-100 to-blue-100 text-slate-800 border-cyan-200 px-4 py-2"
                        >
                          <Star className="w-4 h-4 mr-2" />
                          {avatarData[currentIndex].personality}
                        </Badge>
                      </div>

                      {/* Quote */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 shadow-lg">
                        <p className="text-lg italic text-gray-700 leading-relaxed">
                          "{avatarData[currentIndex].quote}"
                        </p>
                      </div>

                      {/* Selection Button */}
                      <motion.div className="mt-6" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={() => setSelectedAvatar(avatarData[currentIndex].id)}
                          className={`w-full py-4 text-lg font-semibold transition-all duration-300 ${
                            selectedAvatar === avatarData[currentIndex].id
                              ? "bg-gradient-to-r from-teal-400 to-cyan-500 text-white shadow-xl border-3 border-teal-300"
                              : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"
                          }`}
                        >
                          {selectedAvatar === avatarData[currentIndex].id ? (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              Selected
                            </>
                          ) : (
                            <>
                              <Star className="w-5 h-5 mr-2" />
                              Choose This Instructor
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows */}
                <Button
                  onClick={prevAvatar}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/90 hover:bg-black shadow-lg hover:shadow-xl border-2 border-white/20 hover:border-cyan-400 transition-all duration-300"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </Button>
                
                <Button
                  onClick={nextAvatar}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/90 hover:bg-black shadow-lg hover:shadow-xl border-2 border-white/20 hover:border-cyan-400 transition-all duration-300"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </Button>
              </div>

              {/* Thumbnail Navigation */}
              <div className="flex justify-center space-x-4 mb-6 relative z-10">
                {avatarData.map((avatar, index) => (
                  <motion.button
                    key={avatar.id}
                    onClick={() => goToAvatar(index)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`relative w-16 h-16 rounded-full overflow-hidden border-4 transition-all duration-300 ${
                      currentIndex === index
                        ? "border-teal-400 shadow-xl shadow-teal-400/70 scale-110 ring-4 ring-teal-200"
                        : "border-gray-300 hover:border-teal-300"
                    }`}
                  >
                    <ImageWithFallback
                      src={avatar.avatar_url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedAvatar === avatar.id && (
                      <div className="absolute inset-0 bg-teal-400/40 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Progress Dots */}
              <div className="flex justify-center space-x-2 relative z-10">
                {avatarData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToAvatar(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      currentIndex === index
                        ? "bg-teal-400 scale-125 shadow-xl shadow-teal-400/70"
                        : "bg-gray-300 hover:bg-teal-300"
                    }`}
                  />
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Navigation Section */}
          <motion.div 
            className="flex flex-col sm:flex-row justify-between items-center mt-12 space-y-4 sm:space-y-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              variant="outline"
              onClick={onBack}
              className="w-full sm:w-auto border-2 border-white/30 hover:border-cyan-400 text-white hover:text-cyan-400 hover:bg-white/10 transition-all duration-300 px-8 py-3"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>

            <Button
              onClick={handleComplete}
              disabled={!isStepValid()}
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 px-8 py-3 shadow-lg hover:shadow-xl disabled:shadow-none"
            >
              {isStepValid() ? (
                <>
                  Start Your Session
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Select an Instructor First
                  <Music className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
