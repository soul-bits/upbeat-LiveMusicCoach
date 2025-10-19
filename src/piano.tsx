import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Mic, Send, Loader2, Music } from 'lucide-react';
import VectaraLogger from './vectaraLogger';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface PianoTutorProps {
  onEndSession?: (sessionData: {
    duration: number;
    accuracy: number;
    notesPlayed: number;
    mistakes: Array<{
      finger: string;
      timestamp: number;
      note: string;
    }>;
  }) => void;
}

const USE_ACTIVITY_WINDOWS = true; // ✅ recommended for reliable vision grounding

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const PianoTutor: React.FC<PianoTutorProps> = ({ onEndSession }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Not connected');
  const [currentResponse, setCurrentResponse] = useState('');
  const [framesSent, setFramesSent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  const [frameCaptured, setFrameCaptured] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [streamInterval, setStreamInterval] = useState(2000);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [lessonStep, setLessonStep] = useState<'idle' | 'checking_keyboard' | 'checking_hands' | 'checking_hand_position' | 'waiting_song' | 'teaching' | 'adjusting_position'>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkInIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentResponseRef = useRef<string>('');
  const lessonStepRef = useRef<string>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vectaraLoggerRef = useRef<VectaraLogger>(new VectaraLogger('Piano Tutor'));
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // === Simple de-dupe: skip identical model messages ===
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
      // Clean up resources without triggering session end
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }

      stopAudioCapture();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      disconnectWebSocket();
      // Upload final session to Vectara on cleanup
      vectaraLoggerRef.current.uploadFullSession();
    };
  }, []);

  // Session duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionStartTime && isStreaming) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        setSessionDuration(duration);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionStartTime, isStreaming]);

  useEffect(() => {
    lessonStepRef.current = lessonStep;
    console.log(`📍 Lesson step changed to: ${lessonStep}`);
  }, [lessonStep]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

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
- CRITICAL: Count each finger individually. You need to see EXACTLY 10 fingers total.
- Check LEFT HAND: Count 1, 2, 3, 4, 5 fingers each on a separate key
- Check RIGHT HAND: Count 1, 2, 3, 4, 5 fingers each on a separate key
- Each finger must be on its own key, not overlapping
- If you count fewer than 5 fingers on either hand: Say exactly how many you see, e.g., "I can only see 3 fingers on your left hand and 4 on your right. Please spread all 5 fingers on each hand, each on a separate key." Then add: [STATUS:checking_hand_position]
- If fingers are touching/overlapping or in a fist: Say "Your fingers need to be spread out with each finger on its own key. Please separate your fingers." Then add: [STATUS:checking_hand_position]
- ONLY if you count exactly 5 fingers on left hand AND 5 fingers on right hand, each on separate keys: Say "Excellent! Your hand position is perfect - I can see all 5 fingers on each hand properly placed on the keys. What song would you like to learn? Use the buttons below!" Then add: [STATUS:waiting_song]
- When in doubt, describe EXACTLY what you see and ask for adjustment

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
                                        // Log AI response to Vectara
                    vectaraLoggerRef.current.logAIResponse(displayText);
                    lastDisplayedHashRef.current = hash;
                    }
                } else {
                  // Fallback for responses without status commands
                  setMessages(prev => [...prev, {
                    role: 'model',
                    content: finalText,
                    timestamp: new Date()
                  }]);

                  // Log AI response to Vectara
                  vectaraLoggerRef.current.logAIResponse(finalText);
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
      console.warn('⚠️ WebSocket not ready. State:', wsRef.current?.readyState);
      return;
    }

    const frameData = captureVideoFrame();
    if (!frameData) {
      console.warn('⚠️ Failed to capture frame');
      return;
    }

    setFrameCaptured(true);
    setTimeout(() => setFrameCaptured(false), 200);

    // Correct format according to Gemini Live API documentation
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
      console.log('📹 Frame sent successfully at', new Date().toLocaleTimeString(), '| Total frames:', framesSent + 1, '| Size:', frameData.length, 'bytes');
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
        promptText = 'Look at the most recent video frame I sent. Describe what you see. Are there human hands visible in the frame? Are they touching the piano keyboard? If you see hands clearly on the keyboard, respond with [STATUS:checking_hand_position]. If not, describe what you see and respond with [STATUS:checking_hands].';
        break;
      case 'checking_hand_position':
        promptText = 'Examine the current video frame carefully. I need you to count fingers. Left hand - how many fingers can you see? (count: 1, 2, 3, 4, 5?). Right hand - how many fingers can you see? (count: 1, 2, 3, 4, 5?). Tell me the exact number for each hand. If you see 5 fingers on left and 5 on right, each on separate keys, respond with [STATUS:waiting_song]. Otherwise, tell me the exact count you see and respond with [STATUS:checking_hand_position].';
        break;
      case 'waiting_song':
        console.log('⏸️ Check-in skipped - waiting for song selection');
        return;
      case 'teaching':
        promptText = `CRITICAL VISUAL CHECK during teaching:
Look at the current video frame RIGHT NOW and describe EXACTLY what you see:

1. HAND POSITION: Which keys are the student's fingers currently resting on or near?
2. FINGER MOVEMENT: Do you see any finger pressing down on a key?
3. SPECIFIC OBSERVATION: Describe the position - e.g., "I can see the right thumb on Middle C" or "I see the middle finger moving toward G"

Based on what you see:
- If the student's hand position matches your last instruction: Confirm it! Say "Perfect! I can see [specific observation]. Let's continue!" and give the NEXT instruction, then respond with [STATUS:teaching]
- If the position is wrong: Say "I see [what you actually see], but you should have [correct position]. Please adjust." then respond with [STATUS:teaching]
- If you can't see the keyboard or hands clearly: Respond with [STATUS:adjusting_position]

Remember: You are ACTIVELY MONITORING their progress. Describe what you observe before giving the next instruction!`;
        break;
      case 'adjusting_position':
        promptText = 'Check the current video carefully. Describe EXACTLY what you see. Can you now clearly see BOTH the piano keyboard (with visible black and white keys) AND the student\'s hands (with visible fingers)? Is the image clear and not blurry? Be HONEST. If YES (everything clearly visible now), respond with [STATUS:teaching]. If NO or STILL unclear, respond with [STATUS:adjusting_position] and tell me specifically what\'s still wrong.';
        break;
    }

    if (promptText) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📤 [${timestamp}] SENDING CHECK-IN PROMPT`);
      console.log(`📍 Current Step: ${step}`);
      console.log(`💬 Prompt: "${promptText}"`);
      console.log(`${'='.repeat(80)}\n`);

      const message = {
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: promptText }]
          }],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(message));
    }
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
      setLessonStep('checking_keyboard');

      // Initialize session timing
      const now = new Date();
      setSessionStartTime(now);
      setSessionDuration(0);

      setStatusMessage('🎹 Piano lesson started - I can see your hands and hear you play!');

      // Start audio capture
      setTimeout(() => startAudioCapture(), 500);

      // Send initial greeting
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('📤 Sending initial greeting and waiting for more frames...');
          const greetingText = 'Hello! I am your student. I am about to start streaming video frames to you. Please wait for the video input.';
          const message = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{
                  text: greetingText
                }]
              }],
              turnComplete: true
            }
          };
          wsRef.current.send(JSON.stringify(message));

          // Log to Vectara
          vectaraLoggerRef.current.logUserAction(greetingText);
        }
      }, 1000);

      // Wait longer before asking about the video to ensure frames have accumulated
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('📤 Now asking about video content after frames have accumulated');
          const askText = 'I have been sending you video frames for the past few seconds. Can you confirm you are receiving video input from me? Please describe what you see in the video frames. What objects or scenes are visible? Be very specific about what you observe. Then respond with [STATUS:checking_keyboard] or [STATUS:checking_hands] based on what you see.';
          const message = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{
                  text: askText
                }]
              }],
              turnComplete: true
            }
          };
          wsRef.current.send(JSON.stringify(message));

          // Log to Vectara
          vectaraLoggerRef.current.logUserAction(askText);
        }
      }, 6000); // Wait 6 seconds to ensure multiple frames have been sent

      console.log(`🎬 Starting frame capture: ${streamInterval}ms`);
      frameIntervalRef.current = setInterval(() => {
        sendRealtimeFrame();
      }, streamInterval);

      console.log('🔄 Starting check-in interval: 10000ms');
      checkInIntervalRef.current = setInterval(() => {
        const currentStep = lessonStepRef.current;
        console.log('⏰ Check-in triggered - step:', currentStep);

        // During teaching, check more frequently for visual verification
        if (currentStep === 'teaching') {
          console.log('📚 Teaching mode - performing visual verification check');
        }

        sendCheckInMessage(currentStep);
      }, 10000); // Check every 10 seconds

    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStatusMessage('Failed to access camera/microphone - Make sure to allow permissions');
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
    setLessonStep('idle');
    setStatusMessage(isConnected ? 'Connected - Ready to teach!' : 'Not connected');

    // Call session end callback if provided
    if (onEndSession) {
      onEndSession({
        duration: sessionDuration,
        accuracy: 0, // Will be provided by agent
        notesPlayed: 0, // Will be provided by agent
        mistakes: [] // Will be provided by agent
      });
    }
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

    // Log user action to Vectara
    vectaraLoggerRef.current.logUserAction(text);
  };

  const quickSongRequest = (song: string) => {
    sendMessage(`I want to learn how to play "${song}" on piano. Please teach me step by step.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Music className="w-12 h-12" />
            AI Piano Tutor
          </h1>
          <p className="text-slate-300 text-lg">Making music education accessible to everyone, anywhere.</p>
        </div>

        {/* Connection Status */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <div>
                <p className="text-white font-medium">Connection Status</p>
                <p className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                  {statusMessage}
                </p>
              </div>
            </div>
            <button
              onClick={isConnected ? disconnectWebSocket : connectToGemini}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                isConnected
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          {isStreaming && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-sm text-slate-300">
                👀 Watching: {framesSent} frames | Step: {
                  lessonStep === 'checking_keyboard' ? '🎹 Keyboard Check' : 
                  lessonStep === 'checking_hands' ? '👐 Hand Check' : 
                  lessonStep === 'checking_hand_position' ? '✋ Position Check' :
                  lessonStep === 'waiting_song' ? '🎵 Song Select' : 
                  lessonStep === 'teaching' ? '📚 Teaching' : 
                  lessonStep === 'adjusting_position' ? '⚠️ Adjusting' :
                  'Idle'
                }
              </p>
            </div>
          )}
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
                  <li>• <strong>All 10 fingers should be clearly visible</strong></li>
                  <li>• Good lighting on the keys</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">For Best Results:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Place phone/webcam on a stand</li>
                  <li>• Angle slightly downward at 45°</li>
                  <li>• Ensure microphone can hear piano clearly</li>
                  <li>• Quiet environment (minimal background noise)</li>
                  <li>• <strong>Each finger should be visible on its key</strong></li>
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
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
                      lessonStep === 'adjusting_position' ? 'bg-orange-600 animate-pulse' : 'bg-blue-600'
                    }`}>
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-sm font-bold">
                        {lessonStep === 'adjusting_position' ? '⚠️ ADJUST' : 'TEACHING'}
                      </span>
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
                    <div className="bg-cyan-600 px-3 py-1 rounded-full shadow-lg">
                      <span className="text-white text-xs">Last: {lastFrameTime}</span>
                    </div>
                  )}
                  
                  {sessionDuration > 0 && (
                    <div className="bg-green-600 px-3 py-1 rounded-full shadow-lg">
                      <span className="text-white text-xs">
                        Session: {Math.floor(sessionDuration / 60)}:{(sessionDuration % 60).toString().padStart(2, '0')}
                      </span>
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
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-6 h-6" />
                    End Session
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
                  <p className="text-white text-sm font-medium">Quick Song Requests:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => quickSongRequest("Twinkle Twinkle Little Star")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      ⭐ Twinkle Twinkle
                    </button>
                    <button
                      onClick={() => quickSongRequest("Happy Birthday")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      🎂 Happy Birthday
                    </button>
                    <button
                      onClick={() => quickSongRequest("Mary Had a Little Lamb")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                    >
                      🐑 Mary's Lamb
                    </button>
                    <button
                      onClick={() => quickSongRequest("Jingle Bells")}
                      disabled={isProcessing}
                      className="px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
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

            <div ref={chatContainerRef} className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" style={{ maxHeight: '550px' }}>
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
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600'
                            : 'bg-gradient-to-r from-blue-600/40 to-cyan-600/40 backdrop-blur'
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
                      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-600/40 to-cyan-600/40 backdrop-blur shadow-lg">
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
                  className="px-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg transition-all disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Debug Info */}
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
            <div className="bg-cyan-500/20 p-4 rounded-lg">
              <p className="font-medium text-cyan-300 mb-2">🎵 Audio Feedback:</p>
              <ul className="space-y-1 text-xs">
                <li>• Hears the notes you play</li>
                <li>• Confirms correct notes</li>
                <li>• Detects mistakes</li>
                <li>• Checks rhythm and timing</li>
              </ul>
            </div>
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <p className="font-medium text-emerald-300 mb-2">📚 Step-by-Step:</p>
              <ul className="space-y-1 text-xs">
                <li>• Breaks songs into small parts</li>
                <li>• Teaches one hand at a time</li>
                <li>• Patient and encouraging</li>
                <li>• Real-time corrections</li>
              </ul>
            </div>
          </div>
          
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