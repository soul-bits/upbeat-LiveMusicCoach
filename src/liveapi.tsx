import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Mic, MicOff, Send, Loader2, Eye } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const GeminiLiveInteracter: React.FC = () => {
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentResponseRef = useRef<string>('');

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
      // Gemini Live API WebSocket endpoint - use v1beta and Live API models
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log('📡 WebSocket URL:', wsUrl.replace(apiKey, 'API_KEY_HIDDEN'));
      
      const ws = new WebSocket(wsUrl);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('❌ Connection timeout');
          ws.close();
          setStatusMessage('Connection timeout - Live API may not be available yet');
          setIsConnected(false);
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected successfully!');
        setStatusMessage('Connected! Sending setup...');
        
        // Send initial setup message
        // Try different Live API models based on availability
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",  // Experimental model for Live API
            generationConfig: {
              responseModalities: ["TEXT"],
              temperature: 0.7
            }
          }
        };
        
        console.log('📤 Sending setup:', setupMessage);
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          // Check if data is a Blob and convert to text
          let data = event.data;
          if (data instanceof Blob) {
            console.log('📦 Received Blob, converting to text...');
            data = await data.text();
          }

          // Log the raw data type for debugging
          console.log('📥 Raw data type:', typeof data);

          const response = JSON.parse(data);
          console.log('📥 Received message:', response);

          // Handle errors from server
          if (response.error) {
            console.error('❌ Server error:', response.error);
            setStatusMessage(`Error: ${response.error.message || 'Unknown error'}`);
            setIsConnected(false);
            ws.close();
            return;
          }

          // Handle setup complete
          if (response.setupComplete) {
            console.log('✅ Setup complete - Ready to stream!');
            setIsConnected(true);
            setStatusMessage('Connected - Ready to stream!');
            return;
          }

          // Handle server content (streaming response)
          if (response.serverContent) {
            const parts = response.serverContent.modelTurn?.parts || [];
            
            // Accumulate text in ref for immediate access
            parts.forEach((part: any) => {
              if (part.text) {
                console.log('📝 Received text chunk:', part.text);
                currentResponseRef.current += part.text;
                setCurrentResponse(currentResponseRef.current);
              }
            });

            // Check if turn is complete
            if (response.serverContent.turnComplete) {
              console.log('✅ Turn complete, final text:', currentResponseRef.current);
              const finalText = currentResponseRef.current;
              
              if (finalText) {
                setMessages(prev => [...prev, {
                  role: 'model',
                  content: finalText,
                  timestamp: new Date()
                }]);
              } else {
                console.warn('⚠️ Turn complete but no text accumulated');
              }
              
              // Reset for next response
              currentResponseRef.current = '';
              setCurrentResponse('');
              setIsProcessing(false);
            }
          }

          // Handle tool call or other responses
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
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    return dataUrl.split(',')[1];
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

    // Visual feedback - frame captured
    setFrameCaptured(true);
    setTimeout(() => setFrameCaptured(false), 300);
    setLastFrameTime(new Date().toLocaleTimeString());

    // Reset response accumulator
    currentResponseRef.current = '';
    setCurrentResponse('');
    setIsProcessing(true);

    // Send as client content with both image and text
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
    console.log('📸 Frame captured at:', new Date().toLocaleTimeString());
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
        audio: true
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setFramesSent(0);
      setStatusMessage('Camera ready - Frames sent ONLY when you ask questions');

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

  const quickAsk = (question: string) => {
    askQuestion(question);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Gemini Live Vision
          </h1>
          <p className="text-purple-300">Ask questions about what you're showing</p>
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
                📸 Frames sent: {framesSent} (on-demand only)
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
                <li>• Verify your API key is correct (get from <a href="https://ai.google.dev" target="_blank" rel="noopener" className="underline">ai.google.dev</a>)</li>
                <li>• Live API may not be available for all accounts yet</li>
                <li>• Try refreshing the page and connecting again</li>
              </ul>
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

              {/* Frame capture flash effect */}
              {frameCaptured && (
                <div className="absolute inset-0 bg-white animate-pulse" style={{ animationDuration: '300ms' }} />
              )}

              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Video className="w-20 h-20 text-white/30" />
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded-full shadow-lg">
                    <div className="w-3 h-3 bg-white rounded-full" />
                    <span className="text-white text-sm font-bold">READY</span>
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
                    Start Camera
                  </>
                )}
              </button>

              {/* Quick Actions */}
              {isStreaming && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => quickAsk("What am I wearing?")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    What am I wearing?
                  </button>
                  <button
                    onClick={() => quickAsk("Describe what you see in detail")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Describe scene
                  </button>
                  <button
                    onClick={() => quickAsk("What objects can you see?")}
                    disabled={isProcessing}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    What objects?
                  </button>
                  <button
                    onClick={() => quickAsk("What colors do you see?")}
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
                  <Eye className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/50 text-lg">Start camera and ask questions!</p>
                  <p className="text-white/30 text-sm mt-2">Use quick buttons or type your own question</p>
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

            {/* Input */}
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
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-3">How to Use:</h3>
          <div className="grid md:grid-cols-3 gap-4 text-white/80 text-sm mb-4">
            <div>
              <p className="font-medium text-purple-300 mb-2">1. Setup</p>
              <ul className="space-y-1">
                <li>• Get API key from ai.google.dev</li>
                <li>• Click "Connect"</li>
                <li>• Click "Start Camera"</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-purple-300 mb-2">2. Ask Questions (On-Demand)</p>
              <ul className="space-y-1">
                <li>• Click quick action buttons</li>
                <li>• Or type custom questions</li>
                <li>• Frame captured ONLY when you ask</li>
                <li>• No continuous streaming</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-purple-300 mb-2">3. Get Responses</p>
              <ul className="space-y-1">
                <li>• Current frame analyzed instantly</li>
                <li>• Responses stream in real-time</li>
                <li>• Ask follow-up questions anytime</li>
                <li>• Each question = 1 new frame</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm">
              <strong>✅ Smart Frame Capture:</strong> Your camera stays on, but frames are <strong>only captured and sent when you ask a question</strong>. 
              No continuous streaming means you save API quota and get instant responses only when you need them!
            </p>
          </div>
          
          <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm font-medium mb-1">ℹ️ About Live API Models:</p>
            <p className="text-blue-200/80 text-xs mb-2">
              The app uses <code className="text-blue-300">gemini-2.0-flash-exp</code> for the Live API. 
              Check the browser console (F12) to see detailed request/response logs.
            </p>
            <p className="text-blue-200/80 text-xs">
              <strong>What to look for in console:</strong><br/>
              • 📤 "Sending frame with prompt" = Request sent<br/>
              • 📥 "Received message" = Response from Gemini<br/>
              • 📝 "Received text chunk" = Text streaming in<br/>
              • ✅ "Turn complete, final text" = Full response ready<br/>
            </p>
            <p className="text-yellow-200/80 text-xs">
              ⚠️ <strong>Note:</strong> Experimental models have very limited quotas (often just a few requests). 
              If you get "quota exceeded" errors immediately, the experimental model may have no free quota available. 
              The Live API is currently in preview with limited availability.
            </p>
            <p className="text-blue-200/80 text-xs mt-2">
              <strong>Troubleshooting:</strong> Check browser console (F12) for detailed error messages. 
              Endpoint: <code className="text-blue-300">wss://generativelanguage.googleapis.com/.../v1beta/...</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveInteracter;