import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Mic, MicOff, Send, Loader2, Eye, Radio } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

type StreamMode = 'on-demand' | 'continuous';

const GeminiLiveVideoInteracter: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Not connected');
  const [currentResponse, setCurrentResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [framesSent, setFramesSent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  const [frameCaptured, setFrameCaptured] = useState(false);
  const [streamMode, setStreamMode] = useState<StreamMode>('on-demand');
  const [streamInterval, setStreamInterval] = useState(2000); // 2 seconds
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentResponseRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    return () => {
      stopStreaming();
      disconnectWebSocket();
    };
  }, []);

  const connectToGemini = () => {
    if (!apiKey) {
      setStatusMessage('Please enter API key');
      return;
    }

    setStatusMessage('Connecting...');
    console.log('🔄 Attempting to connect to Gemini Live API...');

    try {
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log('📡 WebSocket URL:', wsUrl.replace(apiKey, 'API_KEY_HIDDEN'));
      
      const ws = new WebSocket(wsUrl);
      
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('❌ Connection timeout');
          ws.close();
          setStatusMessage('Connection timeout - Live API may not be available yet');
          setIsConnected(false);
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected successfully!');
        setStatusMessage('Connected! Sending setup...');
        
        // Send initial setup message with system instruction for continuous mode
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["TEXT"], // Can be ["TEXT", "AUDIO"] for audio responses
              temperature: 0.7
            },
            systemInstruction: {
              parts: [{
                text: "You are a helpful AI assistant that can see video and hear audio. When you receive video frames and audio, describe what you see and respond to what you hear in a natural, conversational way. Focus on the most interesting or important elements. Keep responses concise but informative."
              }]
            }
          }
        };
        
        console.log('📤 Sending setup:', setupMessage);
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          let messageData: string;
          
          if (event.data instanceof Blob) {
            messageData = await event.data.text();
          } else {
            messageData = event.data;
          }
          
          const response = JSON.parse(messageData);
          console.log('📥 Received message:', response);

          if (response.error) {
            console.error('❌ Server error:', response.error);
            setStatusMessage(`Error: ${response.error.message || 'Unknown error'}`);
            setIsConnected(false);
            ws.close();
            return;
          }

          if (response.setupComplete) {
            console.log('✅ Setup complete - Ready to stream!');
            setIsConnected(true);
            setStatusMessage('Connected - Ready to stream!');
            return;
          }

          if (response.serverContent) {
            const parts = response.serverContent.modelTurn?.parts || [];
            
            parts.forEach((part: any) => {
              if (part.text) {
                console.log('📝 Received text chunk:', part.text);
                currentResponseRef.current += part.text;
                setCurrentResponse(currentResponseRef.current);
              }
            });

            if (response.serverContent.turnComplete) {
              console.log('✅ Turn complete, final text:', currentResponseRef.current);
              const finalText = currentResponseRef.current;
              
              if (finalText) {
                setMessages(prev => [...prev, {
                  role: 'model',
                  content: finalText,
                  timestamp: new Date()
                }]);
              }
              
              currentResponseRef.current = '';
              setCurrentResponse('');
              setIsProcessing(false);
            }
          }

          if (response.toolCall) {
            console.log('🔧 Tool call:', response.toolCall);
          }

        } catch (error) {
          console.error('❌ Error parsing message:', error, event.data);
          setStatusMessage('Error parsing server response');
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
        setStatusMessage('Connection failed - Check API key & console for details');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('🔌 WebSocket closed. Code:', event.code, 'Reason:', event.reason);
        
        if (event.code === 1006) {
          setStatusMessage('Connection closed abnormally - API key may be invalid');
        } else if (event.code === 1000) {
          setStatusMessage('Disconnected normally');
        } else {
          setStatusMessage(`Disconnected (code: ${event.code})`);
        }
        
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Connection error:', error);
      setStatusMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setStatusMessage('Not connected');
  };

  const captureVideoFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState < 2) return null;

    canvas.width = 640;
    canvas.height = 480;
    
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    return dataUrl.split(',')[1];
  };

  // Convert Float32Array to Int16Array (PCM)
  const floatTo16BitPCM = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  // Convert Int16Array to base64
  const int16ToBase64 = (int16Array: Int16Array): string => {
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  };

  const startAudioCapture = () => {
    if (!streamRef.current || !audioEnabled) return;

    try {
      // Create audio context at 16kHz (required by Gemini)
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const audioSource = audioContextRef.current.createMediaStreamSource(streamRef.current);
      audioSourceRef.current = audioSource;

      // Create audio processor
      const bufferSize = 4096;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !audioEnabled) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Check for voice activity (simple threshold)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const average = sum / inputData.length;
        
        // Update listening indicator
        if (average > 0.01) {
          setIsListening(true);
        } else {
          setIsListening(false);
        }

        // Convert to PCM and send
        const pcmData = floatTo16BitPCM(inputData);
        const base64Audio = int16ToBase64(pcmData);

        const message = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio
            }]
          }
        };

        wsRef.current.send(JSON.stringify(message));
      };

      audioSource.connect(processor);
      processor.connect(audioContextRef.current.destination);

      console.log('🎤 Audio capture started');
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
    }
  };

  const stopAudioCapture = () => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    console.log('🎤 Audio capture stopped');
  };

  const sendRealtimeFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const frameData = captureVideoFrame();
    if (!frameData) return;

    // Visual feedback
    setFrameCaptured(true);
    setTimeout(() => setFrameCaptured(false), 200);

    // Send as realtime input for continuous streaming
    const message = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'image/jpeg',
          data: frameData
        }]
      }
    };

    wsRef.current.send(JSON.stringify(message));
    setFramesSent(prev => prev + 1);
    setLastFrameTime(new Date().toLocaleTimeString());
    console.log('📤 Sent realtime frame at:', new Date().toLocaleTimeString());
  };

  const sendFrameWithPrompt = (prompt: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusMessage('WebSocket not connected');
      return;
    }

    const frameData = captureVideoFrame();
    if (!frameData) {
      setStatusMessage('Failed to capture video frame');
      return;
    }

    setFrameCaptured(true);
    setTimeout(() => setFrameCaptured(false), 300);
    setLastFrameTime(new Date().toLocaleTimeString());

    currentResponseRef.current = '';
    setCurrentResponse('');
    setIsProcessing(true);

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: frameData
              }
            },
            {
              text: prompt
            }
          ]
        }],
        turnComplete: true
      }
    };

    console.log('📤 Sending frame with prompt:', prompt);
    wsRef.current.send(JSON.stringify(message));

    setMessages(prev => [...prev, {
      role: 'user',
      content: prompt,
      timestamp: new Date()
    }]);

    setFramesSent(prev => prev + 1);
  };

  const startStreaming = async () => {
    if (!isConnected) {
      setStatusMessage('Please connect to API first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: audioEnabled ? { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } : false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setFramesSent(0);

      // Start audio capture if enabled
      if (audioEnabled) {
        setTimeout(() => startAudioCapture(), 500);
      }

      if (streamMode === 'continuous') {
        // Start continuous streaming
        setStatusMessage(audioEnabled 
          ? 'Streaming video + audio - AI can see and hear you!' 
          : 'Streaming video continuously - AI will describe what it sees');
        
        // Send initial prompt to start continuous description
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const message = {
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{
                    text: audioEnabled 
                      ? 'I will show you video and speak to you. Please respond to what you see and hear.'
                      : 'Please describe what you see in the video stream. Continue to describe any changes or interesting things you notice.'
                  }]
                }],
                turnComplete: true
              }
            };
            wsRef.current.send(JSON.stringify(message));
          }
        }, 500);

        // Start sending frames at intervals
        frameIntervalRef.current = setInterval(() => {
          sendRealtimeFrame();
        }, streamInterval);
      } else {
        setStatusMessage(audioEnabled 
          ? 'Camera + mic ready - I can see and hear you!'
          : 'Camera ready - Frames sent ONLY when you ask questions');
      }

    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStatusMessage('Failed to access camera/microphone');
    }
  };

  const stopStreaming = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    stopAudioCapture();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setLastFrameTime('');
    setFramesSent(0);
    setStatusMessage(isConnected ? 'Connected - Ready' : 'Not connected');
  };

  const askQuestion = (question: string) => {
    if (!isStreaming) {
      setStatusMessage('Please start camera first');
      return;
    }

    sendFrameWithPrompt(question);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Gemini Live Vision
          </h1>
          <p className="text-purple-300">Real-time video understanding with AI</p>
        </div>

        {/* API Connection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
          <label className="block text-white text-sm font-medium mb-3">
            Gemini API Key
          </label>
          <div className="flex gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key from ai.google.dev"
              className="flex-1 px-4 py-3 bg-white/20 backdrop-blur text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-white/50"
              disabled={isConnected}
            />
            <button
              onClick={isConnected ? disconnectWebSocket : connectToGemini}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                isConnected
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <p className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                {statusMessage}
              </p>
            </div>
            {isStreaming && (
              <p className="text-sm text-purple-300">
                📸 Frames sent: {framesSent}
              </p>
            )}
          </div>

          {!isConnected && apiKey && (
            <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Troubleshooting:</strong>
              </p>
              <ul className="text-yellow-200/80 text-xs mt-1 space-y-1">
                <li>• Open browser console (F12) to see detailed error logs</li>
                <li>• Verify your API key is correct</li>
                <li>• Live API may have limited quota for experimental models</li>
              </ul>
            </div>
          )}
        </div>

        {/* Stream Mode Selector */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Stream Mode</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                disabled={isStreaming}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  audioEnabled 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {audioEnabled ? (
                  <>
                    <Mic className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium">Audio ON</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium">Audio OFF</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (isStreaming) {
                  stopStreaming();
                }
                setStreamMode('on-demand');
              }}
              disabled={isStreaming}
              className={`p-4 rounded-lg border-2 transition-all ${
                streamMode === 'on-demand'
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              } ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Eye className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">On-Demand Mode</span>
              </div>
              <p className="text-sm text-white/70">
                Capture frame only when you ask questions. {audioEnabled ? 'Speak or type your questions.' : 'Type your questions.'}
              </p>
            </button>

            <button
              onClick={() => {
                if (isStreaming) {
                  stopStreaming();
                }
                setStreamMode('continuous');
              }}
              disabled={isStreaming}
              className={`p-4 rounded-lg border-2 transition-all ${
                streamMode === 'continuous'
                  ? 'border-pink-500 bg-pink-500/20'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              } ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Radio className="w-5 h-5 text-pink-400" />
                <span className="text-white font-medium">Continuous Stream</span>
              </div>
              <p className="text-sm text-white/70">
                {audioEnabled 
                  ? 'AI sees video and hears audio continuously. Natural conversation!' 
                  : 'AI describes video automatically. Frames sent at intervals.'}
              </p>
            </button>
          </div>

          {streamMode === 'continuous' && (
            <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <label className="block text-white text-sm font-medium mb-2">
                Frame Interval: {streamInterval / 1000}s
              </label>
              <input
                type="range"
                min="1000"
                max="5000"
                step="500"
                value={streamInterval}
                onChange={(e) => setStreamInterval(Number(e.target.value))}
                disabled={isStreaming}
                className="w-full"
              />
              <p className="text-white/70 text-xs mt-1">
                {isStreaming ? 'Stop streaming to adjust interval' : `Sends ${1000/streamInterval} frames per second`}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4">Camera</h2>

            <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4 shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {frameCaptured && (
                <div className="absolute inset-0 bg-white opacity-50 animate-pulse" style={{ animationDuration: '200ms' }} />
              )}

              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Video className="w-20 h-20 text-white/30" />
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="flex flex-col gap-2">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
                      streamMode === 'continuous' ? 'bg-pink-600' : 'bg-green-600'
                    }`}>
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-sm font-bold">
                        {streamMode === 'continuous' ? 'LIVE STREAM' : 'READY'}
                      </span>
                    </div>
                    
                    {audioEnabled && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg transition-all ${
                        isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600'
                      }`}>
                        <Mic className="w-3 h-3 text-white" />
                        <span className="text-white text-xs font-medium">
                          {isListening ? 'LISTENING' : 'AUDIO'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {lastFrameTime && (
                    <div className="bg-blue-600 px-3 py-1 rounded-full shadow-lg">
                      <span className="text-white text-xs">Last: {lastFrameTime}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                disabled={!isConnected}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-medium transition-all text-lg ${
                  isStreaming
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-6 h-6" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Video className="w-6 h-6" />
                    Start {streamMode === 'continuous' ? 'Live Stream' : 'Camera'}
                  </>
                )}
              </button>

              {streamMode === 'on-demand' && isStreaming && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => askQuestion("What am I wearing?")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    What am I wearing?
                  </button>
                  <button
                    onClick={() => askQuestion("Describe what you see in detail")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Describe scene
                  </button>
                  <button
                    onClick={() => askQuestion("What objects can you see?")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    What objects?
                  </button>
                  <button
                    onClick={() => askQuestion("What colors do you see?")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    What colors?
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20 flex flex-col">
            <h2 className="text-2xl font-semibold text-white mb-4">Conversation</h2>

            <div className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" style={{ maxHeight: '500px' }}>
              {messages.length === 0 && !currentResponse ? (
                <div className="text-center py-16">
                  {streamMode === 'continuous' ? (
                    <>
                      <Radio className="w-16 h-16 text-pink-400/20 mx-auto mb-4" />
                      <p className="text-white/50 text-lg">Start streaming!</p>
                      <p className="text-white/30 text-sm mt-2">AI will automatically describe what it sees</p>
                    </>
                  ) : (
                    <>
                      <Eye className="w-16 h-16 text-purple-400/20 mx-auto mb-4" />
                      <p className="text-white/50 text-lg">Start camera and ask questions!</p>
                      <p className="text-white/30 text-sm mt-2">Use quick buttons or type your own question</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`${msg.role === 'user' ? 'ml-8' : 'mr-8'}`}
                    >
                      <div
                        className={`p-4 rounded-lg shadow-lg ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                            : 'bg-white/20 backdrop-blur'
                        }`}
                      >
                        <p className="text-white whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs text-white/70 mt-2">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {currentResponse && (
                    <div className="mr-8">
                      <div className="p-4 rounded-lg bg-white/20 backdrop-blur shadow-lg">
                        <div className="flex items-start gap-2">
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin mt-1 flex-shrink-0" />
                          <p className="text-white whitespace-pre-wrap">{currentResponse}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input - only show in on-demand mode */}
            {streamMode === 'on-demand' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about the video..."
                  disabled={!isStreaming || isProcessing}
                  className="flex-1 px-4 py-3 bg-white/20 backdrop-blur text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-white/50 disabled:bg-white/10 disabled:cursor-not-allowed"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      askQuestion(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    if (input.value.trim()) {
                      askQuestion(input.value);
                      input.value = '';
                    }
                  }}
                  disabled={!isStreaming || isProcessing}
                  className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-3">How to Use:</h3>
          <div className="grid md:grid-cols-3 gap-4 text-white/80 text-sm mb-4">
            <div>
              <p className="font-medium text-purple-300 mb-2">On-Demand Mode:</p>
              <ul className="space-y-1">
                <li>• Best for specific questions</li>
                <li>• Frame captured only when you ask</li>
                <li>• Saves API quota</li>
                <li>• Use quick buttons or type questions</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-pink-300 mb-2">Continuous Stream Mode:</p>
              <ul className="space-y-1">
                <li>• AI describes video automatically</li>
                <li>• Frames sent at regular intervals</li>
                <li>• Real-time commentary</li>
                <li>• Adjust interval (1-5 seconds)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-green-300 mb-2">🎤 Audio Input:</p>
              <ul className="space-y-1">
                <li>• Toggle audio ON/OFF before starting</li>
                <li>• Speak naturally - AI hears you!</li>
                <li>• Ask "How's the weather today?"</li>
                <li>• Red indicator = AI is listening</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm mb-2">
              <strong>🎤 Audio Feature:</strong> With audio enabled, Gemini can hear your voice in real-time!
            </p>
            <p className="text-green-200/80 text-xs">
              • Audio is processed at 16kHz PCM format<br/>
              • Continuous streaming sends audio + video<br/>
              • In on-demand mode, just speak your questions naturally<br/>
              • Watch for the red "LISTENING" indicator when you speak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveVideoInteracter;