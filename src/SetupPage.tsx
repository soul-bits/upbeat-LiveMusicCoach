import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
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

  const handleComplete = () => {
    onComplete({
      webcamEnabled: false, // Always false since we removed webcam setup
      selectedAvatar
    });
  };

  const isStepValid = () => {
    return selectedAvatar;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 p-4">
      <div className="container mx-auto max-w-4xl py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mb-4 text-purple-300 hover:text-yellow-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl md:text-5xl mb-4 text-white">Choose Your AI Tutor</h1>
          <p className="text-purple-300 text-lg">
            Select your personal piano coach to get started
          </p>
        </div>

        {/* Avatar Selection */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <Card className="p-8 bg-white/90 backdrop-blur-lg border-white/20">
            <p className="text-gray-700 mb-8">
              Each tutor has a unique personality and teaching style. Pick the one that motivates you!
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {avatarData.map((avatar) => (
                <motion.div
                  key={avatar.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`p-6 cursor-pointer transition-all ${
                      selectedAvatar === avatar.id
                        ? "border-yellow-400 shadow-lg shadow-yellow-400/20"
                        : "border-white/20 hover:border-yellow-400/50"
                    }`}
                    onClick={() => setSelectedAvatar(avatar.id)}
                  >
                    <div className="w-16 h-16 rounded-full mb-4 overflow-hidden border-2 border-white/20">
                      <ImageWithFallback
                        src={avatar.avatar_url}
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="mb-2 text-sm font-medium text-black">{avatar.name}</h3>
                    <p className="text-xs text-gray-600 mb-3">{avatar.personality}</p>
                    <div className="bg-white/50 rounded p-3 border border-gray-200">
                      <p className="text-xs italic text-gray-800">"{avatar.quote}"</p>
                    </div>
                    {selectedAvatar === avatar.id && (
                      <Badge className="mt-4 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Check className="w-3 h-3 mr-1" />
                        Selected
                      </Badge>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-white/20 hover:border-yellow-400 text-white hover:text-yellow-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isStepValid()}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold disabled:opacity-50"
          >
            Start Session
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
