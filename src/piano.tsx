import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Mic, Send, Loader2, Music } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const PianoTutor: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Not connected');
  const [currentResponse, setCurrentResponse] = useState('');
  const [framesSent, setFramesSent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  const [frameCaptured, setFrameCaptured] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [streamInterval, setStreamInterval] = useState(2000);
  
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
        
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["TEXT"],
              temperature: 0.7
            },
            systemInstruction: {
              parts: [{
                text: `You are an expert piano instructor with years of teaching experience. You can see the piano keyboard and the student's hands in real-time through video, and you can hear what they play through audio.

Your role is to:

1. **Song Teaching**: When a student asks to learn a song, break it down into simple, manageable steps:
   - Start with the RIGHT HAND ONLY, teaching a few notes at a time
   - Use clear descriptions: "Place your right thumb on Middle C, index finger on D, middle finger on E"
   - After they practice right hand, teach the LEFT HAND separately
   - Finally, guide them to combine both hands slowly
   - Be patient and break songs into small sections (just 4-8 notes at a time)

2. **Visual Guidance**: Since you can see their hands and keyboard:
   - Guide finger placement: "Move your pinky one key to the right"
   - Identify which keys they're pressing: "I can see you're on F# - try moving to G"
   - Correct hand position: "Curve your fingers more, like you're holding a ball"
   - Watch for proper posture

3. **Audio Feedback**: Since you can hear their playing:
   - Confirm correct notes: "Yes! That was perfect - you hit C, E, G correctly"
   - Detect wrong notes: "That second note was D, but should be E. Try again"
   - Check rhythm and timing: "Good, but a bit rushed. Let's slow it down"
   - Listen for dynamics and expression

4. **Step-by-Step Teaching Process**:
   When teaching a song like "Twinkle Twinkle Little Star":
   
   Step 1: "Let's start with just the first 4 notes, RIGHT HAND ONLY:
   - Put your RIGHT thumb on Middle C (the C near the middle of the piano)
   - Play: C - C - G - G
   - That's 'Twin-kle twin-kle'
   - Try it now and I'll listen!"
   
   [Wait for them to play]
   
   Step 2: "Great! Now let's add the next few notes:
   - Continue with: A - A - G (hold G a bit longer)
   - That's 'lit-tle star'
   - So together: C-C-G-G-A-A-G
   - Try the whole thing!"
   
   [Continue this pattern]

5. **Communication Style**:
   - Be encouraging: "Great job!" "You're getting it!" "Almost there!"
   - Be specific: Not just "wrong note" but "That was F instead of E"
   - Be patient: "No problem, let's try that again slowly"
   - Give ONE instruction at a time, don't overwhelm
   - Ask them to confirm: "Can you see Middle C? It should have a small mark or be near the piano brand name"

6. **Key Piano Teaching Principles**:
   - Always start with proper hand position
   - Teach one hand at a time for beginners
   - Use finger numbers (thumb=1, index=2, middle=3, ring=4, pinky=5)
   - Break songs into tiny sections
   - Practice slowly first, speed comes later
   - Celebrate small wins

Remember: You're a PATIENT, ENCOURAGING teacher. Keep responses concise and actionable. Focus on ONE thing at a time. Make learning fun!`
              }]
            }
          }
        };
        
        console.log('📤 Sending setup');
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
            console.log('✅ Setup complete - Piano tutor ready!');
            setIsConnected(true);
            setStatusMessage('Connected - Your AI Piano Tutor is ready!');
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
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    return dataUrl.split(',')[1];
  };

  const floatTo16BitPCM = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  const int16ToBase64 = (int16Array: Int16Array): string => {
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  };

  const startAudioCapture = () => {
    if (!streamRef.current) return;

    try {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const audioSource = audioContextRef.current.createMediaStreamSource(streamRef.current);
      audioSourceRef.current = audioSource;

      const bufferSize = 4096;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const average = sum / inputData.length;
        
        if (average > 0.01) {
          setIsListening(true);
        } else {
          setIsListening(false);
        }

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

      console.log('🎤 Audio capture started - listening to piano');
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

    setFrameCaptured(true);
    setTimeout(() => setFrameCaptured(false), 200);

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
  };

  const startStreaming = async () => {
    if (!isConnected) {
      setStatusMessage('Please connect to API first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setFramesSent(0);

      // Start audio capture
      setTimeout(() => startAudioCapture(), 500);

      setStatusMessage('🎹 Piano lesson started - I can see your hands and hear you play!');
      
      // Send initial greeting
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{
                  text: 'Hello! I want to learn piano. Please introduce yourself and ask me what song I want to learn.'
                }]
              }],
              turnComplete: true
            }
          };
          wsRef.current.send(JSON.stringify(message));
        }
      }, 1000);

      // Start sending frames at intervals
      frameIntervalRef.current = setInterval(() => {
        sendRealtimeFrame();
      }, streamInterval);

    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStatusMessage('Failed to access camera/microphone - Make sure to allow permissions');
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
    setStatusMessage(isConnected ? 'Connected - Ready to teach!' : 'Not connected');
  };

  const sendMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusMessage('Not connected to API');
      return;
    }

    if (!text.trim()) return;

    currentResponseRef.current = '';
    setCurrentResponse('');
    setIsProcessing(true);

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{
            text: text
          }]
        }],
        turnComplete: true
      }
    };

    console.log('📤 Sending message:', text);
    wsRef.current.send(JSON.stringify(message));

    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date()
    }]);
  };

  const quickSongRequest = (song: string) => {
    sendMessage(`I want to learn how to play "${song}" on piano. Please teach me step by step.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Music className="w-12 h-12" />
            AI Piano Tutor
          </h1>
          <p className="text-purple-300 text-lg">Your personal piano teacher - sees your hands, hears you play</p>
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
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
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
                👀 Watching: {framesSent} frames
              </p>
            )}
          </div>
        </div>

        {/* Setup Instructions */}
        {!isStreaming && isConnected && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-yellow-200 font-semibold text-lg mb-3">🎹 Setup Your Camera:</h3>
            <div className="grid md:grid-cols-2 gap-4 text-yellow-100/90 text-sm">
              <div>
                <p className="font-medium mb-2">Camera Position:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Position camera ABOVE the piano</li>
                  <li>• Show the FULL keyboard in view</li>
                  <li>• Make sure BOTH HANDS are visible</li>
                  <li>• Good lighting on the keys</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">For Best Results:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Place phone/webcam on a stand</li>
                  <li>• Angle slightly downward</li>
                  <li>• Ensure microphone can hear piano clearly</li>
                  <li>• Quiet environment (minimal background noise)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Stream Interval Control */}
        {!isStreaming && isConnected && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Video Frame Rate: {streamInterval / 1000}s between frames
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="500"
              value={streamInterval}
              onChange={(e) => setStreamInterval(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-white/70 text-xs mt-1">
              Faster = More responsive feedback, Slower = Less API quota usage
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4">🎹 Piano View</h2>

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
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse" style={{ animationDuration: '200ms' }} />
              )}

              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Music className="w-20 h-20 text-white/30 mb-4" />
                  <p className="text-white/50 text-sm">Position camera to show piano + hands</p>
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-blue-600">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-sm font-bold">TEACHING</span>
                    </div>
                    
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg transition-all ${
                      isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600'
                    }`}>
                      <Mic className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-medium">
                        {isListening ? 'HEARING NOTES' : 'LISTENING'}
                      </span>
                    </div>
                  </div>
                  
                  {lastFrameTime && (
                    <div className="bg-purple-600 px-3 py-1 rounded-full shadow-lg">
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
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-6 h-6" />
                    End Lesson
                  </>
                ) : (
                  <>
                    <Music className="w-6 h-6" />
                    Start Piano Lesson
                  </>
                )}
              </button>

              {isStreaming && (
                <div className="space-y-2">
                  <p className="text-white text-sm font-medium">Quick Song Requests:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => quickSongRequest("Twinkle Twinkle Little Star")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      ⭐ Twinkle Twinkle
                    </button>
                    <button
                      onClick={() => quickSongRequest("Happy Birthday")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      🎂 Happy Birthday
                    </button>
                    <button
                      onClick={() => quickSongRequest("Mary Had a Little Lamb")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      🐑 Mary's Lamb
                    </button>
                    <button
                      onClick={() => quickSongRequest("Jingle Bells")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      🔔 Jingle Bells
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20 flex flex-col">
            <h2 className="text-2xl font-semibold text-white mb-4">💬 Lesson Chat</h2>

            <div className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" style={{ maxHeight: '550px' }}>
              {messages.length === 0 && !currentResponse ? (
                <div className="text-center py-16">
                  <Music className="w-16 h-16 text-blue-400/20 mx-auto mb-4" />
                  <p className="text-white/50 text-lg">Start your lesson!</p>
                  <p className="text-white/30 text-sm mt-2">Your AI piano teacher will guide you step-by-step</p>
                  <p className="text-white/30 text-sm">Ask any question or request a song</p>
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
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600'
                            : 'bg-gradient-to-r from-blue-600/40 to-purple-600/40 backdrop-blur'
                        }`}
                      >
                        <p className="text-white whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p className="text-xs text-white/70 mt-2">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {currentResponse && (
                    <div className="mr-8">
                      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-600/40 to-purple-600/40 backdrop-blur shadow-lg">
                        <div className="flex items-start gap-2">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin mt-1 flex-shrink-0" />
                          <p className="text-white whitespace-pre-wrap leading-relaxed">{currentResponse}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            {isStreaming && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder='Ask: "How do I play C major chord?" or "Teach me Twinkle Twinkle"'
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-white/20 backdrop-blur text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white/50 disabled:bg-white/10 disabled:cursor-not-allowed"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      sendMessage(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    if (input.value.trim()) {
                      sendMessage(input.value);
                      input.value = '';
                    }
                  }}
                  disabled={isProcessing}
                  className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-3">🎹 How Your AI Piano Tutor Works:</h3>
          <div className="grid md:grid-cols-3 gap-4 text-white/80 text-sm mb-4">
            <div className="bg-blue-500/20 p-4 rounded-lg">
              <p className="font-medium text-blue-300 mb-2">👁️ Visual Teaching:</p>
              <ul className="space-y-1 text-xs">
                <li>• Sees your piano keyboard</li>
                <li>• Watches your hand positions</li>
                <li>• Guides finger placement</li>
                <li>• Shows you which keys to press</li>
              </ul>
            </div>
            <div className="bg-purple-500/20 p-4 rounded-lg">
              <p className="font-medium text-purple-300 mb-2">🎵 Audio Feedback:</p>
              <ul className="space-y-1 text-xs">
                <li>• Hears the notes you play</li>
                <li>• Confirms correct notes</li>
                <li>• Detects mistakes</li>
                <li>• Checks rhythm and timing</li>
              </ul>
            </div>
            <div className="bg-pink-500/20 p-4 rounded-lg">
              <p className="font-medium text-pink-300 mb-2">📚 Step-by-Step:</p>
              <ul className="space-y-1 text-xs">
                <li>• Breaks songs into small parts</li>
                <li>• Teaches one hand at a time</li>
                <li>• Patient and encouraging</li>
                <li>• Real-time corrections</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm mb-2">
              <strong>💡 Example Teaching Process:</strong>
            </p>
            <p className="text-green-200/80 text-xs mb-2">
              <strong>You:</strong> "I want to learn Twinkle Twinkle Little Star"
            </p>
            <p className="text-green-200/80 text-xs mb-2">
              <strong>AI Tutor:</strong> "Great choice! Let's start with just the first 4 notes, RIGHT HAND ONLY. Put your right thumb on Middle C. Now play: C - C - G - G. That's 'Twin-kle twin-kle'. Try it!"
            </p>
            <p className="text-green-200/80 text-xs mb-2">
              <strong>[You play the notes]</strong>
            </p>
            <p className="text-green-200/80 text-xs">
              <strong>AI Tutor:</strong> "Perfect! I heard C-C-G-G correctly. Now let's add the next notes..."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PianoTutor;