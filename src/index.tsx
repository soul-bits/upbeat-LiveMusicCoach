import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Camera, Send, Loader2, FileText } from 'lucide-react';
import { logger } from './logger';
import LogViewer from './LogViewer';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  image?: string;
}

const GeminiVideoInteracter: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(3000); // 3 seconds
  const [showLogs, setShowLogs] = useState(false);
  const [logCount, setLogCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Subscribe to logger updates
    const unsubscribe = logger.subscribe((logs) => {
      setLogCount(logs.length);
    });

    return () => {
      stopCapture();
      unsubscribe();
    };
  }, []);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: false 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCapturing(true);
      
      // Start capturing frames at intervals
      intervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, captureInterval);
      
    } catch (error) {
      console.error('Error starting capture:', error);
      alert('Failed to access camera. Please check permissions.');
    }
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCapturing(false);
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return null;

    // Check if video is ready and has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video not ready yet, skipping frame capture');
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL('image/jpeg', 0.8);

    // Validate that we have actual image data (not just the empty data URL prefix)
    if (!dataURL || dataURL.length < 100) {
      console.log('Invalid or empty image data, skipping');
      return null;
    }

    return dataURL;
  };

  const captureAndSendFrame = async () => {
    const frameData = captureFrame();
    if (frameData) {
      await sendToGemini('What do you see in this image?', frameData);
    }
  };

  const sendToGemini = async (prompt: string, imageData?: string) => {
    if (!apiKey) {
      alert('Please enter your API key');
      return;
    }

    setIsLoading(true);

    // Log the request
    logger.log({
      type: 'request',
      prompt: prompt,
      hasImage: !!imageData
    });

    try {
      const parts: any[] = [{ text: prompt }];

      if (imageData) {
        // Remove the data:image/jpeg;base64, prefix
        const base64Data = imageData.split(',')[1];

        // Validate base64 data is not empty
        if (!base64Data || base64Data.trim().length === 0) {
          throw new Error('Empty image data provided');
        }

        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Data
          }
        });

        // Add user message with image
        setMessages(prev => [...prev, {
          role: 'user',
          content: prompt,
          timestamp: new Date(),
          image: imageData
        }]);
      } else {
        // Add text-only user message
        setMessages(prev => [...prev, {
          role: 'user',
          content: prompt,
          timestamp: new Date()
        }]);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: parts
            }]
          })
        }
      );

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content) {
        const text = data.candidates[0].content.parts[0].text;

        // Log the response
        logger.log({
          type: 'response',
          prompt: prompt,
          hasImage: !!imageData,
          response: text
        });

        setMessages(prev => [...prev, {
          role: 'model',
          content: text,
          timestamp: new Date()
        }]);
      } else if (data.error) {
        throw new Error(data.error.message);
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';

      // Log the error
      logger.log({
        type: 'error',
        prompt: prompt,
        hasImage: !!imageData,
        error: errorMessage
      });

      setMessages(prev => [...prev, {
        role: 'model',
        content: `Error: ${errorMessage}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = () => {
    if (!textInput.trim()) return;
    sendToGemini(textInput);
    setTextInput('');
  };

  const handleCaptureSnapshot = () => {
    const frameData = captureFrame();
    if (frameData && textInput.trim()) {
      sendToGemini(textInput, frameData);
      setTextInput('');
    } else if (frameData) {
      sendToGemini('Describe what you see in detail', frameData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-white text-center flex-1">
            Gemini Vision Interacter
          </h1>
          <button
            onClick={() => setShowLogs(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all backdrop-blur border border-white/20"
          >
            <FileText className="w-5 h-5" />
            <span>Logs</span>
            {logCount > 0 && (
              <span className="px-2 py-1 bg-pink-600 rounded-full text-xs font-bold">
                {logCount}
              </span>
            )}
          </button>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Camera Feed</h2>
            
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {!isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Video className="w-16 h-16 text-white/50" />
                </div>
              )}
              
              {isCapturing && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-medium">LIVE</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={isCapturing ? stopCapture : startCapture}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    isCapturing
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white'
                  }`}
                >
                  {isCapturing ? (
                    <>
                      <Square className="w-5 h-5" />
                      Stop Camera
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" />
                      Start Camera
                    </>
                  )}
                </button>

                <button
                  onClick={handleCaptureSnapshot}
                  disabled={!isCapturing || !apiKey}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Snapshot
                </button>
              </div>

              <div className="bg-white/10 rounded-lg p-3">
                <label className="block text-white text-sm font-medium mb-2">
                  Auto-capture interval: {captureInterval / 1000}s
                </label>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={captureInterval}
                  onChange={(e) => setCaptureInterval(Number(e.target.value))}
                  disabled={isCapturing}
                  className="w-full"
                />
                <p className="text-white/70 text-xs mt-1">
                  {isCapturing ? 'Stop camera to adjust interval' : 'Frames sent automatically when camera is running'}
                </p>
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20 flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-4">Conversation</h2>
            
            <div className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4" style={{ maxHeight: '500px' }}>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-12 h-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50">
                    Start camera and ask questions about what you see
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`${
                        msg.role === 'user' ? 'ml-8' : 'mr-8'
                      }`}
                    >
                      {msg.image && (
                        <img 
                          src={msg.image} 
                          alt="Captured frame" 
                          className="w-32 h-24 object-cover rounded-lg mb-2"
                        />
                      )}
                      <div
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600'
                            : 'bg-white/20 backdrop-blur'
                        }`}
                      >
                        <p className="text-white text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs text-white/70 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-white/70 mr-8">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Gemini is thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask about the video or send a message..."
                disabled={!apiKey || isLoading}
                className="flex-1 px-4 py-3 bg-white/20 backdrop-blur text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-white/50 disabled:bg-white/10 disabled:cursor-not-allowed"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleSendText();
                  }
                }}
              />
              <button
                onClick={handleSendText}
                disabled={!apiKey || !textInput.trim() || isLoading}
                className="px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-2">How to use:</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li>• Start the camera to begin capturing video frames</li>
            <li>• Frames are automatically sent to Gemini at the set interval</li>
            <li>• Click "Snapshot" to capture and analyze the current frame with your custom question</li>
            <li>• Type questions to ask about what the camera sees</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GeminiVideoInteracter;