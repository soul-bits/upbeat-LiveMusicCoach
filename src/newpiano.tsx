import React, { useState, useRef, useEffect } from 'react';
import { Square, Loader2, Music, RefreshCcw } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const USE_ACTIVITY_WINDOWS = true; // ✅ recommended for reliable vision grounding

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const PianoTutor: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Not connected');
  const [currentResponse, setCurrentResponse] = useState('');
  const [framesSent, setFramesSent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  const [streamInterval, setStreamInterval] = useState(2000);
  const [lessonStep, setLessonStep] = useState<'idle' | 'checking_keyboard' | 'checking_hands' | 'checking_hand_position' | 'waiting_song' | 'teaching' | 'adjusting_position'>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkInIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentResponseRef = useRef<string>('');
  const lessonStepRef = useRef<string>('idle');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const lastDisplayedHashRef = useRef<string>('');

// tiny hash for de-duping message bodies
const djb2 = (str: string) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
};

// normalize text for comparison (strip [STATUS:...] + compress whitespace)
const normalizeForHash = (s: string) =>
  s.replace(/\[STATUS:[^\]]+\]/g, '')
   .replace(/\s+/g, ' ')
   .trim();
  useEffect(() => {
    return () => {
      stopStreaming();
      disconnectWebSocket();
    };
  }, []);

  useEffect(() => {
    lessonStepRef.current = lessonStep;
    console.log(`📍 Lesson step changed to: ${lessonStep}`);
  }, [lessonStep]);

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
            // 🔧 Make grounding predictable: include *all* realtime input in turns
            realtimeInputConfig: {
              turnCoverage: "TURN_INCLUDES_ALL_INPUT",
              ...(USE_ACTIVITY_WINDOWS ? { automaticActivityDetection: { disabled: true } } : {})
            },
            systemInstruction: {
              parts: [{
                text: `You are an expert piano instructor with years of teaching experience. You can see the piano keyboard and the student's hands in real-time through video.

CRITICAL INSTRUCTION: BE EXTREMELY HONEST about what you see. NEVER claim to see something that is not clearly visible. If you're unsure, say you cannot see it clearly.

You MUST include a status command at the END of EVERY response using this EXACT format:
[STATUS:step_name]

Available steps:
- checking_keyboard
- checking_hands  
- checking_hand_position
- waiting_song
- teaching
- adjusting_position

**STEP 1 - KEYBOARD VISIBILITY CHECK (BE STRICT):**
- CRITICAL: Only proceed if you can CLEARLY see piano keys (black and white keys in a row)
- Look for: Multiple white keys, black keys between them, arranged horizontally
- If you see ANYTHING that is NOT clearly identifiable piano keys (like a desk, table, wall, blurry image, hands without keyboard): Say "I cannot see a piano keyboard yet. Please position your camera so I can see the piano keys clearly - I need to see the white and black keys." Then add: [STATUS:checking_keyboard]
- ONLY if you can CLEARLY and DEFINITIVELY see piano keyboard with visible black and white keys: Say "Perfect! I can see your piano keyboard with the black and white keys. Now please place both hands on the keyboard in playing position." Then add: [STATUS:checking_hands]
- When in doubt, assume you CANNOT see the keyboard clearly

**STEP 2 - HAND PRESENCE CHECK (BE STRICT):**
- CRITICAL: Only proceed if you can see ACTUAL HANDS (with visible fingers) touching or resting on the piano keys
- Look for: Human hands with visible fingers on the keyboard
- If you see NO hands, or only part of an arm, or hands not on keyboard: Say "I'm waiting to see your hands placed on the keyboard. Please put both hands on the piano keys." Then add: [STATUS:checking_hands]
- ONLY if you clearly see hands (with fingers) on the piano keyboard: Say "Good! I can see your hands on the keyboard. Let me check your hand position carefully..." Then add: [STATUS:checking_hand_position]
- When in doubt, assume hands are NOT properly visible

**STEP 3 - HAND POSITION VERIFICATION (BE EXTREMELY STRICT):**
- CRITICAL: Only one hand should be visible and evaluated (either left or right).
- You need to clearly see **exactly 5 fingers** on that one hand, each placed on separate piano keys.
- Count the fingers individually: 1, 2, 3, 4, 5 — each must rest on a distinct white key.
- If you see fewer than 5 fingers, say exactly how many you see (e.g., “I can only see 3 fingers. Please spread all 5 fingers on separate keys.”), then add: [STATUS:checking_hand_position]
- If fingers are touching, overlapping, or in a fist: say “Your fingers need to be spread out with each finger on its own key. Please separate them.”, then add: [STATUS:checking_hand_position]
- ONLY if you can clearly count all 5 fingers on one hand, each on a different key, respond:
  “Excellent! Your hand position is perfect — I can see all 5 fingers properly placed. What song would you like to learn?” then add: [STATUS:waiting_song]
- When in doubt, describe exactly what you see and ask the student to adjust.

**STEP 4 - SONG TEACHING:**
- Once student selects a song, begin teaching
- When you start teaching, add: [STATUS:teaching]
- Break songs into tiny steps (4-8 notes at a time)
- Teach RIGHT HAND first, then LEFT HAND, then combine
- Use clear descriptions: "Place your right thumb on Middle C, index on D..."
- Watch video and provide specific feedback
- Be encouraging and celebrate progress

**CONTINUOUS MONITORING (BE STRICT):**
During teaching, you'll be asked to check visibility every few seconds:
- CRITICAL: Be honest. If the view is unclear, blurry, or you cannot distinctly see the keyboard or hands, speak up immediately
- If you CAN clearly see keyboard (with visible black and white keys) AND hands (with visible fingers): Continue teaching and add: [STATUS:teaching]
- If you CANNOT clearly see keyboard OR hands OR the image is blurry/unclear: Say "Hold on! I can't see [keyboard/hands/the image is blurry]. Please adjust your camera so I have a clear view." Then add: [STATUS:adjusting_position]
- When position is fixed after adjustment: ONLY if you can now clearly see everything, say "Good! I can see everything clearly now. Let's continue..." Then add: [STATUS:teaching]

**CRITICAL RULES FOR HONESTY:**
- NEVER claim to see something you don't clearly see
- If unsure, ALWAYS err on the side of saying you cannot see it
- Be SPECIFIC about what's wrong: "I see a blurry image", "I see a table but no piano", "I see hands but no keyboard", etc.
- ALWAYS count fingers out loud when checking hand position: "I count 3 fingers on the left, 5 on the right"
- Quality teaching requires quality visibility - don't pretend to see things

**CRITICAL RULES:**
- ALWAYS end EVERY response with [STATUS:step_name]
- Keep responses SHORT (1-3 sentences)
- Give ONE instruction at a time
- Be specific about what you see in the video
- Celebrate small wins
- When I ask you to analyze video, look at the current video frames being streamed to you

Example responses:
"Hello! I'm your AI piano tutor. I need to see your piano keyboard. Please adjust your camera so I can see the full keyboard. [STATUS:checking_keyboard]"

"Perfect! I can see your piano keyboard. Now please place both hands on the keyboard in playing position. [STATUS:checking_hands]"

"Excellent! Your hand position is perfect - I can see all 5 fingers on each hand properly placed. What song would you like to learn? [STATUS:waiting_song]"

"Great choice! Let's start with the right hand. Place your thumb on Middle C - that's the white key just to the left of the two black keys in the middle of the keyboard. [STATUS:teaching]"

Remember: NEVER forget to include [STATUS:step_name] at the end of EVERY response!`
              }]
            }
          }
        } as const;
        
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
              const timestamp = new Date().toLocaleTimeString();
              console.log(`\n${'='.repeat(80)}`);
              console.log(`📥 [${timestamp}] GEMINI RESPONSE COMPLETE`);
              console.log(`✅ Turn complete, final text: ${currentResponseRef.current}`);
              console.log(`${'='.repeat(80)}\n`);
              
              const finalText = currentResponseRef.current;
              
            if (finalText) {
            const statusMatch = finalText.match(/\[STATUS:(checking_keyboard|checking_hands|checking_hand_position|waiting_song|teaching|adjusting_position)\]/);

            let displayText = finalText;
            let newStep = null;

            if (statusMatch) {
                newStep = statusMatch[1];
                displayText = finalText.replace(/\[STATUS:[^\]]+\]/g, '').trim();

                console.log(`🎯 STATUS COMMAND DETECTED: ${newStep}`);
                console.log(`📍 Current step: ${lessonStep} → New step: ${newStep}`);

                // ✅ only update step and show message if it changed
                if (newStep !== lessonStep) {
                // Update step if provided
                if (newStep && newStep !== lessonStep) {
                setLessonStep(newStep as any);
                }

                // ✅ De-dupe: show only if text is new
                const normalized = normalizeForHash(displayText);
                const hash = djb2(normalized);

                if (hash === lastDisplayedHashRef.current) {
                console.log('🧽 Duplicate message (same text) — not displaying');
                } else {
                setMessages(prev => [...prev, {
                    role: 'model',
                    content: displayText,
                    timestamp: new Date()
                }]);
                lastDisplayedHashRef.current = hash;
                }
                } else {
                console.log('🔁 Step unchanged — skipping message display');
                }
            }
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
    if (!videoRef.current || !canvasRef.current) {
      console.warn('⚠️ Video or canvas ref not available');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState < 2) {
      console.warn('⚠️ Video not ready. ReadyState:', video.readyState);
      return null;
    }

    canvas.width = 640;
    canvas.height = 480;
    
    const context = canvas.getContext('2d');
    if (!context) {
      console.warn('⚠️ Cannot get canvas context');
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const base64Data = dataUrl.split(',')[1];
    
    if (!base64Data || base64Data.length < 100) {
      console.error('❌ Invalid frame data - too short:', base64Data?.length);
      return null;
    }
    
    console.log('📸 Frame captured. bytes:', base64Data.length);
    return base64Data;
  };

  const sendRealtimeFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready. State:', wsRef.current?.readyState);
      return;
    }

    const frameData = captureVideoFrame();
    if (!frameData) {
      console.warn('⚠️ Failed to capture frame');
      return;
    }

    const message = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: frameData
        }
      }
    };

    try {
      wsRef.current.send(JSON.stringify(message));
      setFramesSent(prev => prev + 1);
      setLastFrameTime(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('❌ Error sending frame:', error);
    }
  };

  const sendCheckInMessage = (step: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Check-in skipped - WebSocket not ready');
      return;
    }

    let promptText = '';
    
    switch(step) {
      case 'checking_keyboard':
        promptText = 'I just sent you video frames. First, confirm you are receiving video input from me. Then, describe in detail what you see in the most recent video frame. What objects, colors, or shapes do you see? Is there a piano keyboard with black and white keys? If you see a piano keyboard clearly, say "I can see a piano keyboard with black and white keys" and respond with [STATUS:checking_hands]. If you see something else or cannot see a piano, describe what you actually see and respond with [STATUS:checking_keyboard].';
        break;
      case 'checking_hands':
        promptText = `
Look at the current video frame carefully. 
Count the fingers on the visible hand — you should see exactly 5 fingers, each on its own piano key. 
If you see fewer than 5, say exactly how many and respond with [STATUS:checking_hand_position]. 
If you see 5 fingers on one hand, each on separate keys, respond with [STATUS:waiting_song].
`;
        break;
      case 'checking_hand_position':
        promptText = 'Examine the current video frame carefully. I need you to count fingers. Left hand - how many fingers can you see? (count: 1, 2, 3, 4, 5?). Right hand - how many fingers can you see? (count: 1, 2, 3, 4, 5?). Tell me the exact number for each hand. If you see 5 fingers on left and 5 on right, each on separate keys, respond with [STATUS:waiting_song]. Otherwise, tell me the exact count you see and respond with [STATUS:checking_hand_position].';
        break;
      case 'waiting_song':
        console.log('⏸️ Check-in skipped - waiting for song selection');
        return;
      case 'teaching':
        promptText = 'Quick HONEST visibility check of the current video: Describe what you see right now. Can you CLEARLY see the piano keyboard (black and white keys) AND the student\'s hands with visible fingers? Be HONEST - if the image is blurry, unclear, or you cannot see these things distinctly, say so immediately. If YES (both clearly visible with good clarity), continue teaching and respond with [STATUS:teaching]. If NO or image quality is poor, respond with [STATUS:adjusting_position] and explain what you cannot see.';
        break;
      case 'adjusting_position':
        promptText = 'Check the current video carefully. Describe EXACTLY what you see. Can you now clearly see BOTH the piano keyboard (with visible black and white keys) AND the student\'s hands (with visible fingers)? Is the image clear and not blurry? Be HONEST. If YES (everything clearly visible now), respond with [STATUS:teaching]. If NO or STILL unclear, respond with [STATUS:adjusting_position] and tell me specifically what\'s still wrong.';
        break;
    }

    if (promptText) {
      void checkInWithFreshFrame(promptText);
    }
  };

  const checkInWithFreshFrame = async (promptText: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (USE_ACTIVITY_WINDOWS) {
      // Explicit batch window for frames
      wsRef.current!.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
      sendRealtimeFrame();
      await sleep(30);
      sendRealtimeFrame();
      wsRef.current!.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      await sleep(80); // give the server a moment to bind
    } else {
      // Simple timing cushion
      sendRealtimeFrame();
      await sleep(120);
    }

    wsRef.current!.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: promptText }]}],
        turnComplete: true
      }
    }));
  };

  const startStreaming = async () => {
    if (!isConnected) {
      setStatusMessage('Please connect to API first');
      return;
    }

    try {
    await openCameraStream(cameraFacing);   // ⬅️ use helper

      setIsStreaming(true);
      setFramesSent(0);
      setLessonStep('checking_keyboard');

      setStatusMessage('🎹 Piano lesson started - I can see you!');
      
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: 'Hello! I am your student. I am about to start streaming video frames to you. Please wait for the video input.' }]
              }],
              turnComplete: true
            }
          } as const;
          wsRef.current.send(JSON.stringify(message));
        }
      }, 1000);

      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: 'I have been sending you video frames for the past few seconds. Can you confirm you are receiving video input from me? Please describe what you see in the video frames. What objects or scenes are visible? Be very specific about what you observe. Then respond with [STATUS:checking_keyboard] or [STATUS:checking_hands] based on what you see.' }]
              }],
              turnComplete: true
            }
          } as const;
          wsRef.current.send(JSON.stringify(message));
        }
      }, 6000);

      console.log(`🎬 Starting frame capture: ${streamInterval}ms`);
      frameIntervalRef.current = setInterval(() => {
        sendRealtimeFrame();
      }, streamInterval);

      console.log('🔄 Starting check-in interval: 10000ms');
      checkInIntervalRef.current = setInterval(() => {
        const currentStep = lessonStepRef.current;
        console.log('⏰ Check-in triggered - step:', currentStep);
        sendCheckInMessage(currentStep);
      }, 10000);

    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStatusMessage('Failed to access camera');
    }
  };


  const stopStreaming = () => {
    console.log('🛑 Stopping streaming...');
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (checkInIntervalRef.current) {
      clearInterval(checkInIntervalRef.current);
      checkInIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      (videoRef.current as any).srcObject = null;
    }

    setIsStreaming(false);
    setLastFrameTime('');
    setFramesSent(0);
    setLessonStep('idle');
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
          parts: [{ text }]
        }],
        turnComplete: true
      }
    } as const;

    console.log('📤 Sending message:', text);
    wsRef.current.send(JSON.stringify(message));

    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date()
    }]);
  };

  const quickSongRequest = (song: string) => {
    sendMessage(`I want to learn "${song}". Please teach me step by step and include [STATUS:teaching] in your response.`);
  };

  // Build constraints for getUserMedia using facing or deviceId
const buildVideoConstraints = (facing: 'user' | 'environment'): MediaStreamConstraints['video'] => {
  if (selectedDeviceId) {
    return { deviceId: { exact: selectedDeviceId }, width: 1280, height: 720, frameRate: 30 } as any;
  }
  // Use facingMode hint (most phones honor this)
  return { facingMode: { ideal: facing }, width: 1280, height: 720, frameRate: 30 } as any;
};

const openCameraStream = async (facing: 'user' | 'environment') => {
  // Stop any existing stream
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  const constraints: MediaStreamConstraints = {
    video: buildVideoConstraints(facing),
    audio: false
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Remember the actual device used (helps flipping reliably next time)
  try {
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    if (settings.deviceId) setSelectedDeviceId(settings.deviceId);
  } catch {}

  streamRef.current = stream;
  if (videoRef.current) {
    (videoRef.current as any).srcObject = stream;
  }
};

const toggleCameraFacing = async () => {
  const next = cameraFacing === 'user' ? 'environment' : 'user';
  setCameraFacing(next);
  try {
    await openCameraStream(next);
  } catch (e) {
    console.error('Flip camera failed, retrying without device lock', e);
    // Retry without binding to prior deviceId
    setSelectedDeviceId(null);
    try { await openCameraStream(next); } catch (err) { console.error('❌ Flip failed', err); }
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Music className="w-12 h-12" />
            AI Piano Tutor
          </h1>
          <p className="text-purple-300 text-lg">Structured visual teaching with real-time video analysis</p>
        </div>

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
                👀 Frames: {framesSent} | Step: {
                  lessonStep === 'checking_keyboard' ? '🎹 Keyboard Check' : 
                  lessonStep === 'checking_hands' ? '👐 Hand Check' : 
                  lessonStep === 'checking_hand_position' ? '✋ Position Check' :
                  lessonStep === 'waiting_song' ? '🎵 Song Select' : 
                  lessonStep === 'teaching' ? '📚 Teaching' : 
                  lessonStep === 'adjusting_position' ? '⚠️ Adjusting' :
                  'Idle'
                }
              </p>
            )}
          </div>
        </div>

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
                  <li>• <strong>All 10 fingers should be clearly visible</strong></li>
                  <li>• Good lighting on the keys</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">For Best Results:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Place phone/webcam on a stand</li>
                  <li>• Angle slightly downward at 45°</li>
                  <li>• Keep camera stable during lesson</li>
                  <li>• Ensure clear view at all times</li>
                  <li>• <strong>Each finger should be visible on its key</strong></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {!isStreaming && isConnected && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Frame Rate: {streamInterval / 1000}s between frames
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
              Faster = More responsive | Slower = Less API usage
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center justify-between">
  <span>🎹 Piano View</span>
  <button
    onClick={toggleCameraFacing}
    disabled={!isConnected}
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20"
    title="Flip camera (front/rear)"
  >
    <RefreshCcw className="w-4 h-4" />
    Flip Camera
  </button>
</h2>


            <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4 shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Music className="w-20 h-20 text-white/30 mb-4" />
                  <p className="text-white/50 text-sm">Camera ready - show piano + hands</p>
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
                    lessonStep === 'adjusting_position' ? 'bg-orange-600 animate-pulse' : 'bg-blue-600'
                  }`}>
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-sm font-bold">
                      {lessonStep === 'adjusting_position' ? '⚠️ ADJUST' : 'ACTIVE'}
                    </span>
                  </div>
                  
                  {lastFrameTime && (
                    <div className="bg-purple-600 px-3 py-1 rounded-full shadow-lg">
                      <span className="text-white text-xs">{lastFrameTime}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

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

              {isStreaming && lessonStep === 'waiting_song' && (
                <div className="space-y-2">
                  <p className="text-white text-sm font-medium">Choose a Song:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => quickSongRequest("Twinkle Twinkle Little Star")}
                      className="px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      ⭐ Twinkle Twinkle
                    </button>
                    <button
                      onClick={() => quickSongRequest("Happy Birthday")}
                      className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      🎂 Happy Birthday
                    </button>
                    <button
                      onClick={() => quickSongRequest("Mary Had a Little Lamb")}
                      className="px-4 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      🐑 Mary's Lamb
                    </button>
                    <button
                      onClick={() => quickSongRequest("Jingle Bells")}
                      className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      🔔 Jingle Bells
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20 flex flex-col">
            <h2 className="text-2xl font-semibold text-white mb-4">💬 Lesson Chat</h2>

            <div className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" style={{ maxHeight: '550px' }}>
              {messages.length === 0 && !currentResponse ? (
                <div className="text-center py-16">
                  <Music className="w-16 h-16 text-blue-400/20 mx-auto mb-4" />
                  <p className="text-white/50 text-lg">Ready for your lesson!</p>
                  <p className="text-white/30 text-sm mt-2">Click "Start Piano Lesson"</p>
                  <p className="text-white/30 text-xs mt-3 italic">AI tutor will guide you automatically</p>
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

            {isStreaming && (
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-blue-200 text-sm text-center">
                  👁️ <strong>Video-Based Teaching</strong>
                </p>
                <p className="text-blue-200/80 text-xs text-center mt-1">
                  Your tutor analyzes live video frames every {streamInterval/1000}s
                </p>
              </div>
            )}
          </div>
        </div>

        {isStreaming && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-200 text-sm font-medium mb-2">🔍 Debug Info (F12 Console for details):</p>
            <div className="grid grid-cols-4 gap-4 text-xs text-yellow-200/80">
              <div>
                <strong>WebSocket:</strong> {wsRef.current?.readyState === WebSocket.OPEN ? '✅ Open' : '❌ Not Open'}
              </div>
              <div>
                <strong>Video Ready:</strong> {videoRef.current?.readyState === 4 ? '✅ Ready' : '⏳ Loading'}
              </div>
              <div>
                <strong>Frame Interval:</strong> {frameIntervalRef.current ? '✅ Running' : '❌ Not Running'}
              </div>
              <div>
                <strong>Check-in Interval:</strong> {checkInIntervalRef.current ? '✅ Running' : '❌ Not Running'}
              </div>
            </div>
            <p className="text-yellow-200/60 text-xs mt-2">
              Frames: Every {streamInterval/1000}s | Check-ins: Every 10s | Total sent: {framesSent}
            </p>
          </div>
        )}

        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm mb-3">
              <strong>💡 How It Works - Automatic 4-Step Workflow:</strong>
            </p>
            
            <div className="space-y-2 text-green-200/80 text-xs">
              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 1 - Keyboard Detection 🎹</p>
                <p>AI analyzes video stream → If keyboard visible: "Perfect! I can see the keyboard" [moves to Step 2]</p>
                <p>If not visible: Asks you to adjust camera position</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 2 - Hand Presence 👐</p>
                <p>AI watches for hands → When detected: "Good! I can see your hands" [moves to Step 3]</p>
                <p>Prompts: "Please place both hands on the keyboard"</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 3 - Hand Position Verification ✋</p>
                <p>AI carefully counts fingers on BOTH hands (must see all 10 fingers, each on a key)</p>
                <p>If correct: "Excellent! Perfect hand position!" [moves to Step 4]</p>
                <p>If incorrect: Guides you to adjust finger placement</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 4 - Song Teaching 🎵</p>
                <p>You select a song → AI begins step-by-step teaching</p>
                <p>Teaches right hand first, then left hand, then both together</p>
                <p>Gives specific visual feedback based on what it sees in the video</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg border-2 border-blue-400">
                <p className="font-semibold text-blue-300 mb-1">🔄 Continuous Monitoring (During Teaching)</p>
                <p>Every 10 seconds: AI checks if it can still see keyboard + hands clearly</p>
                <p>If visibility is lost: Pauses lesson and asks you to adjust camera</p>
                <p>Once fixed: Resumes teaching automatically</p>
              </div>
            </div>

            <div className="mt-3 text-center text-green-200/60 text-xs italic">
              Just start the lesson and follow the AI tutor's instructions! 🎼
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PianoTutor;
