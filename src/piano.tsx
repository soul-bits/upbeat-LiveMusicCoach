import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Mic, Send, Loader2, Music, FlipHorizontal } from 'lucide-react';
import VectaraLogger from './vectaraLogger';
import { useAvatar } from './AvatarContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { videoPrompt, step1, step2, step3, step4, step5, criticalRules } from './videoPrompt';  
import { createNoteDetector, type DetectedNote, type NoteDetectorWrapper } from './noteDetectorWrapper';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}
const USE_ACTIVITY_WINDOWS = true; // ✅ recommended for reliable vision grounding

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

interface MusicInstructorProps {
  onEndSession?: (sessionData: {
    duration: number;
    accuracy: number;
    notesPlayed: number;
    mistakes: Array<{
      finger: string;
      timestamp: number;
      note: string;
    }>;
    conversationSummary?: string;
    summaryAvatar?: {
      id: string;
      name: string;
      avatar_url: string;
      video_url: string;
      voice_id: string;
      personality: string;
      quote: string;
    };
    summaryAudioUrl?: string;
  }) => void;
  onProgressUpdate?: (message: string) => void;
  onAvatarSelected?: (avatar: any) => void;
  onStartEndSession?: () => void;
}

const MusicInstructor: React.FC<MusicInstructorProps> = ({ onEndSession, onProgressUpdate, onAvatarSelected, onStartEndSession }) => {
  const { selectedAvatar } = useAvatar();
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const apiKey = 'AIzaSyArNymd-xkyPh1j8QGLn9YziblxjULZeGA' || '';
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
  const [summaryAvatar, setSummaryAvatar] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCheckInInProgress, setIsCheckInInProgress] = useState(false);

  // Note detection state
  const [currentNote, setCurrentNote] = useState<DetectedNote | null>(null);
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
  const [isNoteDetectionActive, setIsNoteDetectionActive] = useState(false);

  // Camera state - default to back camera (environment)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkInIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentResponseRef = useRef<string>('');
  const lessonStepRef = useRef<string>('idle');
  const isCheckInInProgressRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vectaraLoggerRef = useRef<VectaraLogger>(new VectaraLogger('Music Instructor'));
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const noteDetectorRef = useRef<NoteDetectorWrapper | null>(null);
  const frameCounterRef = useRef(0);

  const lastDisplayedHashRef = useRef<string>('');
  
  const djb2 = (str: string) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
  };

  const normalizeForHash = (s: string) =>
    s.replace(/\[STATUS:[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  useEffect(() => {
    return () => {
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
      vectaraLoggerRef.current.uploadFullSession();
    };
  }, []);

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
    
    // Start audio capture when entering waiting_song or teaching stage
    if ((lessonStep === 'waiting_song' || lessonStep === 'teaching') && isStreaming && !audioContextRef.current) {
      console.log('🎤 Starting audio capture for voice input...');
      setTimeout(() => startAudioCapture(), 500);
    }
    
    // Stop audio when not in teaching stages
    if (lessonStep !== 'waiting_song' && lessonStep !== 'teaching' && audioContextRef.current) {
      console.log('🎤 Stopping audio capture - not in teaching stage');
      stopAudioCapture();
    }
  }, [lessonStep, isStreaming]);

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
            realtimeInputConfig: {
              turnCoverage: "TURN_INCLUDES_ALL_INPUT",
              ...(USE_ACTIVITY_WINDOWS ? { automaticActivityDetection: { disabled: true } } : {})
            },
            systemInstruction: {
              parts: [{
                text: videoPrompt + step1 + step2 + step3 + step4 + step5 + criticalRules
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
            console.log('✅ Setup complete - Music instructor ready!');
            setIsConnected(true);
            setStatusMessage('Connected - Your AI Music Instructor is ready!');
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
                // Check for SESSION_COMPLETE marker to auto-end session
                if (finalText.includes('SESSION_COMPLETE')) {
                  console.log('🎉 SESSION_COMPLETE detected - ending session automatically');
                  const displayText = finalText.replace('SESSION_COMPLETE - ', '').trim();

                  setMessages(prev => [...prev, {
                    role: 'model',
                    content: displayText,
                    timestamp: new Date()
                  }]);
                  vectaraLoggerRef.current.logAIResponse(displayText);
                  generateTTS(displayText);

                  // Wait 3 seconds to let the user read the message, then end session
                  setTimeout(() => {
                    console.log('⏰ Auto-ending session after 2-part completion');
                    stopStreaming();
                  }, 3000);

                  currentResponseRef.current = '';
                  setCurrentResponse('');
                  setIsProcessing(false);
                  return;
                }

                const statusMatch = finalText.match(/\[STATUS:(checking_keyboard|checking_hands|checking_hand_position|waiting_song|teaching|adjusting_position)\]/);

                let displayText = finalText;
                let newStep = null;

                if (statusMatch) {
                  newStep = statusMatch[1];
                  displayText = finalText.replace(/\[STATUS:[^\]]+\]/g, '').trim();

                  console.log(`🎯 STATUS COMMAND DETECTED: ${newStep}`);
                  console.log(`📍 Current step: ${lessonStep} → New step: ${newStep}`);

                  if (newStep && newStep !== lessonStep) {
                    setLessonStep(newStep as any);
                  }

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
                    vectaraLoggerRef.current.logAIResponse(displayText);
                    
                    // Generate TTS for new response
                    generateTTS(displayText);
                    
                    lastDisplayedHashRef.current = hash;
                  }
                } else {
                  setMessages(prev => [...prev, {
                    role: 'model',
                    content: finalText,
                    timestamp: new Date()
                  }]);
                  vectaraLoggerRef.current.logAIResponse(finalText);
                  
                  // Generate TTS for new response
                  generateTTS(finalText);
                }
              }
              
              currentResponseRef.current = '';
              setCurrentResponse('');
              setIsProcessing(false);
              setIsCheckInInProgress(false); // Reset check-in flag when response is complete
              isCheckInInProgressRef.current = false; // Also update ref
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


  const generateTTS = (text: string) => {
    console.log('🎵 TTS called with text:', text);
    
    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
      console.warn('⚠️ Speech synthesis not supported in this browser');
      return;
    }

    // Skip if text is empty or too short
    if (!text || text.trim().length < 3) {
      console.log('🔇 Skipping TTS - text too short');
      return;
    }

    // Check if speech synthesis is speaking
    if (speechSynthesis.speaking) {
      console.log('🔇 Speech already in progress, cancelling...');
      speechSynthesis.cancel();
    }
    
    // Wait a bit before starting new speech to avoid interruption
    setTimeout(() => {
      // Process text to handle musical notes with special pronunciation
      const processedText = text
        .replace(/\b([CDEFGAB])\b/g, '$1~') // Add ~ to musical notes for emphasis
        .replace(/\b([CDEFGAB])~/g, '$1~') // Ensure notes have the ~ symbol
        .replace(/Middle C/gi, 'Middle C~') // Special case for "Middle C"
        .replace(/key ([CDEFGAB])/gi, 'key $1~'); // Notes after "key"

      const utterance = new SpeechSynthesisUtterance(processedText);
      
      // Configure voice settings for a warm, friendly music teacher tone
      utterance.rate = 0.9; // Slightly slower for teaching
      utterance.pitch = 1.1; // Slightly higher pitch for friendliness
      utterance.volume = 0.8; // Good volume level
      
      // Try to find a suitable voice
      const voices = speechSynthesis.getVoices();
      console.log('🎤 Available voices:', voices.length);
      console.log('🎤 Voice names:', voices.map(v => v.name));
      
      const preferredVoices = ['Google UK English Female', 'Google US English Female', 'Microsoft Zira Desktop'];
      
      for (const voiceName of preferredVoices) {
        const voice = voices.find(v => v.name.includes(voiceName));
        if (voice) {
          utterance.voice = voice;
          console.log('🎤 Using preferred voice:', voice.name);
          break;
        }
      }
      
      // If no preferred voice found, use the first available English voice
      if (!utterance.voice) {
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('🎤 Using English voice:', englishVoice.name);
        } else {
          console.log('🎤 Using default voice');
        }
      }

      utterance.onstart = () => {
        console.log('🔊 TTS started speaking:', processedText.substring(0, 50) + '...');
      };

      utterance.onend = () => {
        console.log('🔊 TTS finished speaking');
      };

      utterance.onerror = (event) => {
        // Only log non-interruption errors
        if (event.error !== 'interrupted') {
          console.error('❌ TTS error:', event.error);
        } else {
          console.log('🔇 TTS interrupted (normal)');
        }
      };

      // Speak the text
      try {
        speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('❌ Failed to start speech synthesis:', error);
      }
    }, 100); // Small delay to prevent interruption
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

      console.log('🎤 Audio capture started - listening for voice input and notes');
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
      frameCounterRef.current += 1;
      setLastFrameTime(new Date().toLocaleTimeString());
      console.log('📹 Frame sent successfully at', new Date().toLocaleTimeString(), '| Total frames:', framesSent + 1, '| Size:', frameData.length, 'bytes');

      // Disabled: Every-3-frames ping can cause multiple responses and conflicts with check-ins
      // The regular check-in interval (every 11 seconds) is sufficient for monitoring
      /*
      if (frameCounterRef.current % 3 === 0) {
        wsRef.current.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text:
              'Use the most recent frames you just received to judge the current action. Keep replies short. [STATUS:teaching]'
            }]}],
            turnComplete: true
          }
        }));
      }
      */
    } catch (error) {
      console.error('❌ Error sending frame:', error);
    }
  };

  const checkInWithFreshFrame = async (promptText: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Simplified approach: Just send one fresh frame then the prompt
    // Activity windows can sometimes cause multiple responses
    sendRealtimeFrame();
    await sleep(200); // Give Gemini time to process the frame

    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: promptText }]}],
        turnComplete: true
      }
    }));
  };

  const sendCheckInMessage = (step: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Check-in skipped - WebSocket not ready');
      return;
    }

    // Skip if a check-in is already in progress (use ref for interval callback)
    if (isCheckInInProgressRef.current) {
      console.warn('⚠️ Check-in skipped - Previous check-in still in progress');
      return;
    }

    let promptText = '';

    switch(step) {
      case 'checking_keyboard':
        promptText = 'Look at the most recent video frame I sent you. Describe EXACTLY what you see in the image. What objects, colors, or shapes are visible? Be completely honest - if you see a person\'s face, say so. If you see a desk or table, say so. If you see a piano keyboard with black and white keys, say so. Don\'t pretend to see things that aren\'t there. Based on what you actually see, respond with [STATUS:checking_hands] only if you can clearly see piano keys, otherwise respond with [STATUS:checking_keyboard].';
        break;
      case 'checking_hands':
        promptText = 'Look at the most recent video frame I sent. Describe EXACTLY what you see. Are there human hands visible in the frame? Are they actually touching the piano keyboard? Be honest - if you don\'t see hands, say so. If you see hands but they\'re not on the keyboard, say so. Only if you clearly see hands actually placed on the piano keyboard, respond with [STATUS:checking_hand_position]. Otherwise, describe what you actually see and respond with [STATUS:checking_hands].';
        break;
      case 'checking_hand_position':
        promptText = 'Look at the current video frame carefully. I need you to count what you actually see. Left hand - how many fingers can you clearly see? (count: 1, 2, 3, 4, 5?). Right hand - how many fingers can you clearly see? (count: 1, 2, 3, 4, 5?). Tell me the exact number for each hand based on what you actually see. If you can clearly see 5 fingers on left and 5 on right, each on separate keys, say "Perfect! Your hands are positioned correctly. Let\'s start learning Twinkle Twinkle Little Star! We\'ll learn just 2 parts of the song." Then IMMEDIATELY start teaching the first part of Twinkle Twinkle and respond with [STATUS:teaching]. Otherwise, tell me the exact count you see and respond with [STATUS:checking_hand_position].';
        break;
      case 'waiting_song':
        console.log('⏸️ Check-in skipped - waiting for song selection');
        return;
      case 'teaching':
        promptText = `CRITICAL VISUAL CHECK during Twinkle Twinkle (2 PARTS ONLY):
Look at the current video frame RIGHT NOW and describe EXACTLY what you see:

1. FINGER POSITION: Which specific key is the finger pressing? (e.g., "I see your thumb on Middle C")
2. CORRECT KEY: Is it the RIGHT key for the current note in the sequence?
3. PROGRESS: Which part are we on? Part 1 (C C G G A A G) or Part 2 (F F E E D D C)?

**VERIFY EACH NOTE BEFORE MOVING ON:**
- Say what you SEE: "I can see your [finger] pressing [key name]"
- If CORRECT: "Perfect! That's [note name]. Now press [next note]" then respond with [STATUS:teaching]
- If WRONG key: "I see your finger on [wrong key], please move to [correct key]" then respond with [STATUS:teaching]
- If can't see clearly: "I can't see which key you're pressing clearly" then respond with [STATUS:adjusting_position]

**AFTER PART 2 COMPLETES (all notes C C G G A A G F F E E D D C):**
- Say: "Excellent work! You've learned the first 2 parts of Twinkle Twinkle Little Star! That's all for today's lesson. Great job! SESSION_COMPLETE - The student has successfully learned 2 parts of Twinkle Twinkle."

Remember: ONLY 2 parts! Verify EACH finger press visually. Be HONEST about what you see!`;
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

      setIsCheckInInProgress(true); // Mark check-in as in progress
      isCheckInInProgressRef.current = true; // Also update ref

      // Use checkInWithFreshFrame for better video grounding
      void checkInWithFreshFrame(promptText);
    }
  };

  const startStreaming = async () => {
    if (!isConnected) {
      setStatusMessage('Please connect to API first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: facingMode  // Use current facing mode
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100  // Higher sample rate for better note detection
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize note detector FIRST (before voice capture to avoid MediaStream conflicts)
      try {
        console.log('🎵 Initializing note detector with stream...');
        const detector = createNoteDetector({
          dataSize: 2048,
          sampleRate: 44100,
          windowType: 'hamming',
          closeThreshold: 0.05,
          trackLoneMs: 100,
          trackConsMs: 50,
          detrackMinVolume: 0.005,
          detrackEstNoneMs: 500,
          detrackEstSomeMs: 250,
          stableNoteMs: 150  // Increase stability threshold to reduce false positives
        });

        await detector.initialize();

        // IMPORTANT: Connect audio source BEFORE starting detection
        console.log('🎵 Connecting audio source to note detector...');
        detector.connectAudioSource(stream);

        // Set callback for detected notes
        detector.setOnNoteDetected((note: DetectedNote) => {
          console.log(`🎹 Note detected: ${note.note}${note.octave} (${note.frequency.toFixed(1)}Hz, stable: ${note.stable})`);
          setCurrentNote(note);
          setDetectedNotes(prev => [...prev.slice(-19), note]);

          // Send note to AI instructor if it's stable
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && note.stable) {
            const noteMessage = `[NOTE_DETECTED] ${note.note}${note.octave} (${note.frequency.toFixed(1)}Hz, confidence: ${note.confidence.toFixed(2)})`;
            console.log('🎵 Stable note detected:', noteMessage);

            // Optionally send to AI (can be toggled)
            // const message = {
            //   clientContent: {
            //     turns: [{
            //       role: 'user',
            //       parts: [{ text: noteMessage }]
            //     }],
            //     turnComplete: true
            //   }
            // };
            // wsRef.current.send(JSON.stringify(message));
          }
        });

        await detector.startDetection();
        noteDetectorRef.current = detector;
        setIsNoteDetectionActive(true);
        console.log('✅ Note detector initialized and started successfully');
      } catch (error) {
        console.error('❌ Failed to initialize note detector:', error);
        console.error('Error details:', error);
        // Continue anyway - note detection is optional
      }

      setIsStreaming(true);
      setFramesSent(0);
      frameCounterRef.current = 0;
      setLessonStep('checking_keyboard');

      const now = new Date();
      setSessionStartTime(now);
      setSessionDuration(0);

      setStatusMessage('🎹 Piano lesson started - I can see your hands and hear your notes!');

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
          vectaraLoggerRef.current.logUserAction(greetingText);
        }
      }, 1000);

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
          vectaraLoggerRef.current.logUserAction(askText);
        }
      }, 6000);

      console.log(`🎬 Starting frame capture: ${streamInterval}ms`);
      frameIntervalRef.current = setInterval(() => {
        sendRealtimeFrame();
      }, streamInterval);

      console.log('🔄 Starting check-in interval: 8000ms');
      checkInIntervalRef.current = setInterval(() => {
        const currentStep = lessonStepRef.current;
        console.log('⏰ Check-in triggered - step:', currentStep);

        if (currentStep === 'teaching') {
          console.log('📚 Teaching mode - performing visual verification check');
        }

        sendCheckInMessage(currentStep);
      }, 11000);

    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStatusMessage('Failed to access camera/microphone - Make sure to allow permissions');
    }
  };

  const switchCamera = async () => {
    if (!isStreaming) return;

    console.log('🔄 Switching camera...');

    // Stop current stream
    stopAudioCapture();

    // Stop note detector
    if (noteDetectorRef.current) {
      noteDetectorRef.current.stopDetection();
      noteDetectorRef.current.destroy();
      noteDetectorRef.current = null;
      setIsNoteDetectionActive(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Toggle facing mode
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    try {
      // Start new stream with new camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: newFacingMode
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Reinitialize note detector with new stream
      try {
        console.log('🎵 Reinitializing note detector with new camera stream...');
        const detector = createNoteDetector({
          dataSize: 2048,
          sampleRate: 44100,
          windowType: 'hamming',
          closeThreshold: 0.05,
          trackLoneMs: 100,
          trackConsMs: 50,
          detrackMinVolume: 0.005,
          detrackEstNoneMs: 500,
          detrackEstSomeMs: 250,
          stableNoteMs: 150  // Increase stability threshold to reduce false positives
        });

        await detector.initialize();

        // IMPORTANT: Connect audio source BEFORE starting detection
        console.log('🎵 Connecting new audio source to note detector...');
        detector.connectAudioSource(stream);

        detector.setOnNoteDetected((note: DetectedNote) => {
          console.log(`🎹 Note detected: ${note.note}${note.octave} (${note.frequency.toFixed(1)}Hz, stable: ${note.stable})`);
          setCurrentNote(note);
          setDetectedNotes(prev => [...prev.slice(-19), note]);

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && note.stable) {
            const noteMessage = `[NOTE_DETECTED] ${note.note}${note.octave} (${note.frequency.toFixed(1)}Hz, confidence: ${note.confidence.toFixed(2)})`;
            console.log('🎵 Stable note detected:', noteMessage);
          }
        });

        await detector.startDetection();
        noteDetectorRef.current = detector;
        setIsNoteDetectionActive(true);
        console.log('✅ Note detector reinitialized with new camera successfully');
      } catch (error) {
        console.error('❌ Failed to reinitialize note detector:', error);
        console.error('Error details:', error);
      }

      // Restart audio capture if in teaching mode
      if (lessonStep === 'waiting_song' || lessonStep === 'teaching') {
        setTimeout(() => startAudioCapture(), 500);
      }

      console.log(`✅ Switched to ${newFacingMode} camera`);
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      setStatusMessage('Failed to switch camera - Make sure both cameras are available');
    }
  };

  const stopStreaming = async () => {
    console.log('🛑 Stopping streaming...');

    // Trigger loading page immediately
    if (onStartEndSession) {
      onStartEndSession();
    }
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (checkInIntervalRef.current) {
      clearInterval(checkInIntervalRef.current);
      checkInIntervalRef.current = null;
    }

    stopAudioCapture();

    // Stop note detector
    if (noteDetectorRef.current) {
      noteDetectorRef.current.stopDetection();
      noteDetectorRef.current.destroy();
      noteDetectorRef.current = null;
      setIsNoteDetectionActive(false);
      setCurrentNote(null);
      console.log('✅ Note detector stopped and cleaned up');
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
    setLessonStep('idle');
    setStatusMessage(isConnected ? 'Connected - Ready to teach!' : 'Not connected');

    if (onEndSession) {
      // Select random avatar and generate session summary
      console.log('🎭 Selecting random avatar for summary...');
      onProgressUpdate?.('Selecting your instructor...');
      setIsGeneratingSummary(true);
      
      try {
        const randomAvatar = await selectRandomAvatar();
        setSummaryAvatar(randomAvatar);
        onAvatarSelected?.(randomAvatar);
        onProgressUpdate?.(`${randomAvatar.name} is writing your session summary...`);
        
        console.log('📝 Generating session summary with avatar:', randomAvatar.name);
        const {summary, audioUrl} = await generateSessionSummary(messages, sessionDuration, randomAvatar);
        console.log('✅ Session summary generated by', randomAvatar.name);
        
        onProgressUpdate?.('Preparing audio...');
        
        // Small delay to show the "Preparing audio..." message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        onProgressUpdate?.('Complete!');
        
        // Small delay before navigating to summary
        await new Promise(resolve => setTimeout(resolve, 500));
        
        onEndSession({
          duration: sessionDuration,
          accuracy: 0,
          notesPlayed: 0,
          mistakes: [],
          conversationSummary: summary,
          summaryAvatar: randomAvatar,
          summaryAudioUrl: audioUrl
        });
      } catch (error) {
        console.error('❌ Error generating summary:', error);
        onProgressUpdate?.('Complete!');
        
        // Small delay before navigating to summary
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Still call onEndSession even if summary generation fails
        onEndSession({
          duration: sessionDuration,
          accuracy: 0,
          notesPlayed: 0,
          mistakes: [],
          conversationSummary: 'Session summary generation failed.',
          summaryAvatar: undefined,
          summaryAudioUrl: undefined
        });
      } finally {
        setIsGeneratingSummary(false);
      }
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

    vectaraLoggerRef.current.logUserAction(text);
  };

  const quickSongRequest = (song: string) => {
    sendMessage(`I want to learn how to play "${song}" on piano. Please teach me step by step.`);
  };

  const testTTS = () => {
    console.log('🧪 Testing TTS...');
    generateTTS("Hello! This is a test of the text to speech system. Can you hear me?");
  };

  const selectRandomAvatar = async (): Promise<any> => {
    try {
      const response = await fetch('/avatars/avatar.json');
      const avatars = await response.json();
      const randomIndex = Math.floor(Math.random() * avatars.length);
      const selectedAvatar = avatars[randomIndex];
      console.log('🎭 Selected random avatar for summary:', selectedAvatar.name);
      return selectedAvatar;
    } catch (error) {
      console.error('❌ Error loading avatars:', error);
      // Fallback to a default avatar structure
      return {
        id: 'default',
        name: 'Professor Melody',
        system_prompt: 'You are a helpful music instructor.',
        avatar_url: '',
        personality: 'Helpful and encouraging.',
        quote: 'Great work on your lesson!'
      };
    }
  };

  const generateSessionSummary = async (messages: Message[], duration: number, avatar: any): Promise<{summary: string, audioUrl?: string}> => {
    if (!apiKey) {
      console.warn('No API key available for summary generation');
      return {summary: 'Session summary unavailable - API key not configured'};
    }

    if (messages.length === 0) {
      return {summary: 'No conversation recorded during this session.'};
    }

    try {
      // Format the conversation for the prompt
      const conversationText = messages.map(msg => {
        const role = msg.role === 'user' ? 'Student' : 'Professor Melody';
        const time = msg.timestamp.toLocaleTimeString();
        return `[${time}] ${role}: ${msg.content}`;
      }).join('\n\n');

      const prompt = `${avatar.system_prompt}

You're Professor Melody's assistant sharing the reflections of the lessons with the student. Please create a very concise summary of this piano lesson session.

Conversation Log:
${conversationText}

Please provide a 2-3 lines ONLY summary that includes:
1. What was taught/learned during the session in a concise manner
2. Key progress made by the student in a concise manner 
3. Areas that may need more practice in a concise manner
4. Overall assessment of the lesson in a concise manner

Make sure to keep the summary concise, short and to the point.
`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate session summary.';

      // Generate audio immediately after getting the summary
      let audioUrl: string | undefined;
      try {
        audioUrl = await generateSummaryAudio(summary, avatar.voice_id);
        console.log('🎵 Audio generated successfully for summary');
      } catch (audioError) {
        console.warn('⚠️ Failed to generate audio, continuing without audio:', audioError);
      }

      return {summary, audioUrl};
    } catch (error) {
      console.error('Error generating session summary:', error);
      return {summary: 'Session summary generation failed. Please check your API key and try again.'};
    }
  };

  const generateSummaryAudio = async (text: string, voiceId: string): Promise<string> => {
    const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            {selectedAvatar && (
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-cyan-400 shadow-xl">
                <ImageWithFallback
                  src={selectedAvatar.avatar_url}
                  alt={selectedAvatar.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h1 className="text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
              <Music className="w-12 h-12" />
              {selectedAvatar ? `Hello, I am ${selectedAvatar.name}` : 'AI Music Instructor'}
            </h1>
          </div>
          <p className="text-slate-300 text-lg">
            {selectedAvatar ? selectedAvatar.quote : 'Making music education accessible to everyone, anywhere.'}
          </p>
        </div>

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
            <div className="flex gap-3">
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
              <button
                onClick={testTTS}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
              >
                🔊 Test TTS
              </button>
            </div>
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
                {(lessonStep === 'waiting_song' || lessonStep === 'teaching') && ' | 🎤 Audio Active'}
              </p>
            </div>
          )}

          {isGeneratingSummary && summaryAvatar && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-cyan-400">
                  <ImageWithFallback
                    src={summaryAvatar.avatar_url}
                    alt={summaryAvatar.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-cyan-300 font-medium">{summaryAvatar.name} is writing your summary...</p>
                  <p className="text-xs text-slate-400">{summaryAvatar.personality}</p>
                </div>
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-auto" />
              </div>
            </div>
          )}
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
                  <li>• Quiet environment (minimal background noise)</li>
                  <li>• <strong>Each finger should be visible on its key</strong></li>
                  <li>• Voice input enabled once setup complete</li>
                </ul>
              </div>
            </div>
          </div>
        )}

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ minHeight: '600px' }}>
          {/* Camera Section - Left Column */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              📹 Camera Feed
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

              {frameCaptured && (
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse" style={{ animationDuration: '200ms' }} />
              )}

              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Music className="w-20 h-20 text-white/30 mb-4" />
                  <p className="text-white/50 text-sm text-center">Position camera to show piano + hands</p>
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="flex flex-col gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg text-xs ${
                      lessonStep === 'adjusting_position' ? 'bg-orange-600 animate-pulse' : 'bg-blue-600'
                    }`}>
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="text-white font-bold">
                        {lessonStep === 'adjusting_position' ? '⚠️ ADJUST' : 'TEACHING'}
                      </span>
                    </div>

                    {(lessonStep === 'waiting_song' || lessonStep === 'teaching') && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg transition-all text-xs ${
                        isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600'
                      }`}>
                        <Mic className="w-3 h-3 text-white" />
                        <span className="text-white font-medium">
                          {isListening ? 'HEARING' : 'LISTENING'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 items-end">
                    {lastFrameTime && (
                      <div className="bg-cyan-600 px-2.5 py-1 rounded-full shadow-lg">
                        <span className="text-white text-xs">Last: {lastFrameTime}</span>
                      </div>
                    )}

                    {sessionDuration > 0 && (
                      <div className="bg-green-600 px-2.5 py-1 rounded-full shadow-lg">
                        <span className="text-white text-xs">
                          {Math.floor(sessionDuration / 60)}:{(sessionDuration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Camera Switch Button */}
              {isStreaming && (
                <button
                  onClick={switchCamera}
                  className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center shadow-lg border-2 border-white/30 hover:border-cyan-400 transition-all duration-300 group"
                  title={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
                >
                  <FlipHorizontal className="w-4 h-4 text-white group-hover:text-cyan-400 transition-colors" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                disabled={!isConnected}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all text-sm ${
                  isStreaming
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-4 h-4" />
                    End Session
                  </>
                ) : (
                  <>
                    <Music className="w-4 h-4" />
                    Start Lesson
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - AI Chat */}
          <div className="space-y-4">
            {/* AI Chat Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-white/20 flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                💬 AI Instructor
              </h2>

            {/* Quick Song Requests - Show at top of chat when ready */}
            {isStreaming && lessonStep === 'waiting_song' && (
              <div className="mb-4 p-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl">
                <p className="text-white text-sm font-medium mb-2">🎵 Quick Song Requests:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => quickSongRequest("Twinkle Twinkle Little Star")}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg text-xs font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                  >
                    ⭐ Twinkle
                  </button>
                  <button
                    onClick={() => quickSongRequest("Happy Birthday")}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                  >
                    🎂 Birthday
                  </button>
                  <button
                    onClick={() => quickSongRequest("Mary Had a Little Lamb")}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                  >
                    🐑 Mary's Lamb
                  </button>
                  <button
                    onClick={() => quickSongRequest("Jingle Bells")}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg text-xs font-medium transition-all disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
                  >
                    🔔 Jingle Bells
                  </button>
                </div>
              </div>
            )}

            <div ref={chatContainerRef} className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" style={{ minHeight: '400px', maxHeight: '500px' }}>
              {messages.length === 0 && !currentResponse ? (
                <div className="text-center py-12">
                  <Music className="w-12 h-12 text-blue-400/20 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">Start your lesson!</p>
                  <p className="text-white/30 text-xs mt-1">Your AI piano teacher will guide you step-by-step</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`${msg.role === 'user' ? 'ml-8' : 'mr-8'}`}
                    >
                      <div
                        className={`p-3 rounded-lg shadow-lg ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600'
                            : 'bg-gradient-to-r from-blue-600/40 to-cyan-600/40 backdrop-blur'
                        }`}
                      >
                        <p className="text-white whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                        <p className="text-xs text-white/60 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {currentResponse && (
                    <div className="mr-8">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-blue-600/40 to-cyan-600/40 backdrop-blur shadow-lg">
                        <div className="flex items-start gap-2">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin mt-0.5 flex-shrink-0" />
                          <p className="text-white whitespace-pre-wrap leading-relaxed text-sm">{currentResponse}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {isStreaming && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder='Ask: "How do I play C major chord?" or "Teach me a song"'
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 bg-white/20 backdrop-blur text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white/50 disabled:bg-white/10 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg transition-all disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
            </div>
          </div>

          {/* Note Detection - Ultra Compact */}
          <div className="mt-2 bg-white/10 backdrop-blur-lg rounded-lg p-2 shadow-2xl border border-white/20">
            <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-1">
              🎵 Note Detection
            </h2>

            {/* Current Note Display - Ultra Compact */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-2 mb-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-semibold text-xs">Current Note</h3>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                  isNoteDetectionActive ? 'bg-green-600' : 'bg-gray-600'
                }`}>
                  <div className={`w-1 h-1 rounded-full ${isNoteDetectionActive ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-white text-xs">{isNoteDetectionActive ? 'ON' : 'OFF'}</span>
                </div>
              </div>

              {currentNote && currentNote.stable ? (
                <div className="bg-black/30 rounded p-2 text-center">
                  <div className="text-xl font-bold text-white">{currentNote.note}{currentNote.octave}</div>
                  <div className="text-xs text-purple-300">{currentNote.frequency.toFixed(1)} Hz</div>
                </div>
              ) : (
                <div className="bg-black/30 rounded p-2 text-center">
                  <div className="text-white/50 text-xs">{isNoteDetectionActive ? 'Waiting...' : 'Inactive'}</div>
                </div>
              )}
            </div>

            {/* Recent Notes - Ultra Compact */}
            {detectedNotes.length > 0 && (
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-2">
                <h3 className="text-white font-semibold text-xs mb-1">Recent</h3>
                <div className="grid grid-cols-6 gap-1">
                  {detectedNotes.slice(-6).reverse().map((note, idx) => (
                    <div
                      key={idx}
                      className={`p-1 rounded text-center ${note.stable ? 'bg-purple-600/60 text-white' : 'bg-gray-600/40 text-gray-300'}`}
                    >
                      <div className="text-xs font-bold">{note.note}{note.octave}</div>
                    </div>
                  ))}
                </div>
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
                <strong>Audio:</strong> {audioContextRef.current ? '✅ Active' : '❌ Inactive'}
              </div>
            </div>
            <p className="text-yellow-200/60 text-xs mt-2">
              Frames: Every {streamInterval/1000}s | Check-ins: Every 10s | Total sent: {framesSent} | Audio: {(lessonStep === 'waiting_song' || lessonStep === 'teaching') ? 'ON' : 'OFF'}
            </p>
          </div>
        )}

        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-3">🎹 How Your AI Music Instructor Works:</h3>
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
              <p className="font-medium text-cyan-300 mb-2">🎤 Voice & Audio:</p>
              <ul className="space-y-1 text-xs">
                <li>• Activates during song selection</li>
                <li>• Speak the song name you want</li>
                <li>• Hears your questions during teaching</li>
                <li>• Natural conversation while learning</li>
              </ul>
            </div>
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <p className="font-medium text-emerald-300 mb-2">📚 Step-by-Step:</p>
              <ul className="space-y-1 text-xs">
                <li>• Breaks songs into small parts</li>
                <li>• Teaches one hand at a time</li>
                <li>• Patient and encouraging</li>
                <li>• Real-time visual feedback</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm mb-3">
              <strong>💡 Automatic 4-Step Workflow:</strong>
            </p>
            
            <div className="space-y-2 text-green-200/80 text-xs">
              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 1 - Keyboard Detection 🎹</p>
                <p>AI analyzes video → Confirms keyboard visible → Moves to hands check</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 2 - Hand Presence 👐</p>
                <p>AI watches for hands → Detects hands on keyboard → Moves to position check</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg">
                <p className="font-semibold text-green-300 mb-1">Step 3 - Hand Position ✋</p>
                <p>AI counts all 10 fingers → Verifies proper placement → Ready for song</p>
              </div>

              <div className="p-3 bg-black/20 rounded-lg border-2 border-cyan-400">
                <p className="font-semibold text-cyan-300 mb-1">Step 4 - Song Teaching 🎵 (Audio Active!)</p>
                <p><strong>🎤 Microphone activates here!</strong> You can speak the song name or use buttons</p>
                <p>AI teaches step-by-step: Small chunks → Practice → Combine</p>
                <p>Continuous visual monitoring with voice interaction</p>
              </div>
            </div>

            <div className="mt-3 text-center text-green-200/60 text-xs italic">
              Audio streaming begins only when ready for teaching - saves API quota! 🎼
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicInstructor;