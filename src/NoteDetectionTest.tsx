import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Square, Mic, MicOff } from 'lucide-react';
import { NoteDetectorWrapper, DetectedNote, createNoteDetector } from './noteDetectorWrapper';

const NoteDetectionTest: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
  const [status, setStatus] = useState('Not initialized');
  const [isListening, setIsListening] = useState(false);
  
  const noteDetectorRef = useRef<NoteDetectorWrapper | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const initializeNoteDetector = async () => {
      try {
        setStatus('Initializing Note Detector...');
        
        const detector = createNoteDetector({
          dataSize: 4096,
          sampleRate: 44100,
          windowType: 'hann',
          closeThreshold: 0.05,
          trackLoneMs: 100,
          trackConsMs: 50,
          detrackMinVolume: 0.005,
          detrackEstNoneMs: 500,
          detrackEstSomeMs: 250,
          stableNoteMs: 50
        });
        
        await detector.initialize();
        noteDetectorRef.current = detector;
        
        // Set up note detection callback
        detector.setOnNoteDetected((note: DetectedNote) => {
          setDetectedNotes(prev => {
            const newNotes = [...prev, note];
            return newNotes.slice(-20);
          });
          console.log('🎵 Note detected:', note);
        });
        
        setStatus('Ready');
        setIsInitialized(true);
        console.log('✅ Note detector initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize note detector:', error);
        setStatus('Failed to initialize');
      }
    };

    initializeNoteDetector();

    return () => {
      if (noteDetectorRef.current) {
        noteDetectorRef.current.destroy();
        noteDetectorRef.current = null;
      }
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    if (!isInitialized || !noteDetectorRef.current) {
      console.warn('⚠️ Note detector not initialized');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      
      // Connect audio source to note detector
      noteDetectorRef.current.connectAudioSource(stream);
      
      // Start detection
      noteDetectorRef.current.startDetection();

      setIsRecording(true);
      setIsListening(true);
      setStatus('Recording - Play some notes!');
      console.log('🎤 Recording started with note detection');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setStatus('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (noteDetectorRef.current) {
      noteDetectorRef.current.stopDetection();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsListening(false);
    setStatus('Stopped');
    console.log('🎤 Recording stopped');
  };

  const clearNotes = () => {
    setDetectedNotes([]);
  };

  const testWithTone = () => {
    if (!isInitialized || !noteDetectorRef.current) {
      console.warn('⚠️ Note detector not initialized');
      return;
    }

    // Generate a test tone (A4 = 440Hz)
    const sampleRate = 44100;
    const duration = 1; // 1 second
    const frequency = 440; // A4
    const samples = sampleRate * duration;
    const testAudio = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      testAudio[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    }
    
    console.log('🧪 Testing note detection with A4 (440Hz)...');
    
    const detectedNotes = noteDetectorRef.current.processAudioBuffer(testAudio);
    console.log('🎵 Test detection results:', detectedNotes);
    
    if (detectedNotes.length > 0) {
      setDetectedNotes(prev => [...prev, ...detectedNotes]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Volume2 className="w-10 h-10" />
            Audio Note Detection Test
          </h1>
          <p className="text-slate-300 text-lg">
            Test real-time note detection from your microphone
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 shadow-2xl border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${isInitialized ? 'bg-green-400' : 'bg-red-400'}`} />
              <div>
                <h3 className="text-white font-semibold text-lg">Status</h3>
                <p className={`text-sm ${isInitialized ? 'text-green-400' : 'text-red-400'}`}>
                  {status}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRecording && (
                <div className={`flex items-center gap-2 ${isListening ? 'text-red-400' : 'text-gray-400'}`}>
                  <Mic className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {isListening ? 'Listening...' : 'Silent'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isInitialized}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Recording
                </>
              )}
            </button>

            <button
              onClick={testWithTone}
              disabled={!isInitialized}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
            >
              🧪 Test with A4 Tone
            </button>

            <button
              onClick={clearNotes}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
            >
              🗑️ Clear Notes
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-yellow-200 font-semibold text-lg mb-3">🎹 How to Test:</h3>
          <div className="grid md:grid-cols-2 gap-4 text-yellow-100/90 text-sm">
            <div>
              <p className="font-medium mb-2">Real-time Testing:</p>
              <ul className="space-y-1 text-xs">
                <li>• Click "Start Recording" to begin</li>
                <li>• Play notes on a piano or keyboard</li>
                <li>• Watch for detected notes below</li>
                <li>• Make sure microphone is near the piano</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">Test Tone:</p>
              <ul className="space-y-1 text-xs">
                <li>• Click "Test with A4 Tone" for automated test</li>
                <li>• Generates a 440Hz sine wave</li>
                <li>• Should detect as "A4" note</li>
                <li>• Good for verifying the system works</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Detected Notes Display */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">🎵 Detected Notes</h3>
            <span className="text-gray-400 text-sm">
              {detectedNotes.length} notes detected
            </span>
          </div>

          {detectedNotes.length === 0 ? (
            <div className="text-center py-8">
              <Volume2 className="w-16 h-16 text-blue-400/20 mx-auto mb-4" />
              <p className="text-white/50 text-lg">No notes detected yet</p>
              <p className="text-white/30 text-sm mt-2">
                Start recording and play some piano keys!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {detectedNotes.slice().reverse().map((note, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 rounded-lg shadow-lg"
                >
                  <div className="text-white font-bold text-xl mb-1">
                    {note.note}<sub className="text-sm">{note.octave}</sub>
                  </div>
                  <div className="text-cyan-200 text-sm">
                    {note.frequency.toFixed(1)}Hz
                  </div>
                  <div className="text-cyan-300 text-xs">
                    Confidence: {(note.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-cyan-400 text-xs">
                    {new Date(note.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical Info */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-3">🔧 Technical Details</h3>
          <div className="grid md:grid-cols-2 gap-4 text-white/80 text-sm">
            <div>
              <p className="font-medium text-cyan-300 mb-2">Detection Algorithm:</p>
              <ul className="space-y-1 text-xs">
                <li>• Multi-algorithm approach (ACX, YIN, MPM)</li>
                <li>• Frame size: 4096 samples</li>
                <li>• Window function: Hann</li>
                <li>• Sample rate: 44.1kHz</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-cyan-300 mb-2">Detection Features:</p>
              <ul className="space-y-1 text-xs">
                <li>• Consensus-based detection</li>
                <li>• Note tracking and stability</li>
                <li>• Volume-based filtering</li>
                <li>• Real-time processing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetectionTest;
