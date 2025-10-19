// TypeScript wrapper for note-detector.js and note-utils.js

export interface DetectedNote {
  note: string;
  octave: number;
  frequency: number;
  confidence: number;
  timestamp: number;
  stable: boolean;
}

export interface NoteDetectorConfig {
  dataSize: number;
  sampleRate: number;
  windowType: 'raw' | 'hann' | 'hamming' | 'blackman' | 'lanczos';
  closeThreshold?: number;
  trackLoneMs?: number;
  trackConsMs?: number;
  detrackMinVolume?: number;
  detrackEstNoneMs?: number;
  detrackEstSomeMs?: number;
  stableNoteMs?: number;
}

// Import the JavaScript modules
declare const NoteDetector: any;
declare const hzToNote: (freq: number) => number;
declare const noteString: (note: number) => string;
declare const hzToNoteString: (freq: number) => string;
declare const noteToHz: (note: number) => number;

export class NoteDetectorWrapper {
  private detector: any;
  private config: NoteDetectorConfig;
  private onNoteDetected?: (note: DetectedNote) => void;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private dataArray?: Float32Array;
  private animationFrame?: number;
  private isDetecting: boolean = false;

  constructor(config: NoteDetectorConfig) {
    this.config = {
      closeThreshold: 0.05,
      trackLoneMs: 100,
      trackConsMs: 50,
      detrackMinVolume: 0.005,
      detrackEstNoneMs: 500,
      detrackEstSomeMs: 250,
      stableNoteMs: 50,
      ...config
    };

    // Initialize the detector will be done after scripts are loaded
  }

  setOnNoteDetected(callback: (note: DetectedNote) => void) {
    this.onNoteDetected = callback;
  }

  async initialize(): Promise<void> {
    console.log('🎵 Initializing note detector...');
    console.log('📊 Config:', this.config);

    try {
      // Load the JavaScript modules
      await this.loadScripts();

      // Initialize the detector after scripts are loaded
      console.log('🔧 Creating NoteDetector instance...');
      this.detector = new (window as any).NoteDetector(
        this.config.dataSize,
        this.config.sampleRate,
        this.config.windowType
      );
      console.log('✅ NoteDetector instance created');

      // Initialize audio context
      console.log('🎤 Creating AudioContext...');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('AudioContext not supported in this browser');
      }

      // iOS Safari may require lower sample rates
      try {
        this.audioContext = new AudioContextClass({
          sampleRate: this.config.sampleRate
        });
        console.log(`✅ AudioContext created with sample rate: ${this.audioContext.sampleRate}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create AudioContext with ${this.config.sampleRate}Hz, trying default...`, error);
        // Fallback to default sample rate on iOS
        this.audioContext = new AudioContextClass();
        console.log(`✅ AudioContext created with default sample rate: ${this.audioContext.sampleRate}`);
      }

      console.log('✅ Note detector initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize note detector:', error);
      throw error;
    }
  }

  private async loadScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if scripts are already loaded
      if (typeof (window as any).NoteDetector !== 'undefined' && typeof (window as any).hzToNote !== 'undefined') {
        console.log('📝 Note detector scripts already loaded');
        resolve();
        return;
      }

      console.log('📦 Loading note detector scripts...');

      // Load note-utils.js
      const utilsScript = document.createElement('script');
      utilsScript.src = '/src/note-utils.js';
      utilsScript.type = 'text/javascript';

      utilsScript.onload = () => {
        console.log('✅ note-utils.js loaded successfully');

        // Verify the functions are available
        if (typeof (window as any).hzToNote === 'undefined') {
          console.error('❌ hzToNote function not found after loading note-utils.js');
          reject(new Error('note-utils.js loaded but functions not available'));
          return;
        }

        // Load note-detector.js
        const detectorScript = document.createElement('script');
        detectorScript.src = '/src/note-detector.js';
        detectorScript.type = 'text/javascript';

        detectorScript.onload = () => {
          console.log('✅ note-detector.js loaded successfully');

          // Verify NoteDetector is available
          if (typeof (window as any).NoteDetector === 'undefined') {
            console.error('❌ NoteDetector class not found after loading note-detector.js');
            reject(new Error('note-detector.js loaded but NoteDetector not available'));
            return;
          }

          console.log('✅ All note detector scripts loaded and verified');
          resolve();
        };

        detectorScript.onerror = (error) => {
          console.error('❌ Failed to load note-detector.js:', error);
          reject(new Error('Failed to load note-detector.js'));
        };

        document.head.appendChild(detectorScript);
      };

      utilsScript.onerror = (error) => {
        console.error('❌ Failed to load note-utils.js:', error);
        reject(new Error('Failed to load note-utils.js'));
      };

      document.head.appendChild(utilsScript);
    });
  }

  connectAudioSource(stream: MediaStream): void {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    console.log('🔌 Connecting audio source to note detector...');
    console.log('📊 Stream tracks:', stream.getTracks().map(t => ({
      kind: t.kind,
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState
    })));

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      console.log('✅ MediaStreamSource created');

      this.analyser = this.audioContext.createAnalyser();
      // Use the exact dataSize for time domain data
      this.analyser.fftSize = this.config.dataSize * 2;
      this.analyser.smoothingTimeConstant = 0; // No smoothing for note detection
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      console.log(`✅ AnalyserNode created with fftSize: ${this.analyser.fftSize}`);

      source.connect(this.analyser);
      // Use frequencyBinCount for time domain data which equals fftSize
      this.dataArray = new Float32Array(this.analyser.fftSize);
      console.log(`✅ Audio source connected, buffer size: ${this.dataArray.length}`);
    } catch (error) {
      console.error('❌ Failed to connect audio source:', error);
      throw error;
    }
  }

  async startDetection(): Promise<void> {
    if (this.isDetecting) {
      console.log('⚠️ Detection already running');
      return;
    }

    console.log('🎬 Starting note detection...');

    // Resume AudioContext if suspended (iOS requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('⏸️ AudioContext is suspended, attempting to resume...');
      try {
        await this.audioContext.resume();
        console.log('✅ AudioContext resumed successfully');
      } catch (error) {
        console.error('❌ Failed to resume AudioContext:', error);
      }
    }

    if (this.audioContext) {
      console.log(`🎤 AudioContext state: ${this.audioContext.state}`);
      console.log(`🎤 AudioContext sample rate: ${this.audioContext.sampleRate}`);
    }

    this.isDetecting = true;
    console.log('✅ Detection started');
    this.detectionLoop();
  }

  stopDetection(): void {
    this.isDetecting = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  private detectionLoop(): void {
    if (!this.isDetecting || !this.analyser || !this.dataArray || !this.detector) {
      if (!this.isDetecting) console.log('⚠️ Detection loop stopped: isDetecting = false');
      if (!this.analyser) console.log('⚠️ Detection loop stopped: no analyser');
      if (!this.dataArray) console.log('⚠️ Detection loop stopped: no dataArray');
      if (!this.detector) console.log('⚠️ Detection loop stopped: no detector');
      return;
    }

    try {
      // Get time-domain audio data (waveform)
      this.analyser.getFloatTimeDomainData(this.dataArray);

      // Calculate RMS to check for audio signal
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i] * this.dataArray[i];
      }
      const rms = Math.sqrt(sum / this.dataArray.length);

      // Only log occasionally to avoid console spam
      if (Math.random() < 0.01) {
        console.log(`🎵 Audio RMS: ${rms.toFixed(4)}, Buffer size: ${this.dataArray.length}`);
      }

      // Process with note detector (requires exactly dataSize samples)
      const processBuffer = new Float32Array(this.config.dataSize);
      for (let i = 0; i < this.config.dataSize && i < this.dataArray.length; i++) {
        processBuffer[i] = this.dataArray[i];
      }

      this.detector.update(processBuffer);

      // Get detected note
      const result = this.detector.getNote();

      if (result && result.freq > 0) {
        const noteNumber = (window as any).hzToNote(result.freq);
        const noteStr = (window as any).noteString(noteNumber);
        const octave = Math.floor((noteNumber - 49) / 12) + 4;

        const detectedNote: DetectedNote = {
          note: noteStr.replace(/\d+$/, ''), // Remove octave number from note string
          octave: octave,
          frequency: result.freq,
          confidence: result.stable ? 0.9 : 0.5, // Higher confidence for stable notes
          timestamp: Date.now(),
          stable: result.stable
        };

        if (this.onNoteDetected) {
          this.onNoteDetected(detectedNote);
        }
      }
    } catch (error) {
      console.error('❌ Error in detection loop:', error);
    }

    // Continue detection loop
    this.animationFrame = requestAnimationFrame(() => this.detectionLoop());
  }

  processAudioBuffer(buffer: Float32Array): DetectedNote[] {
    const results: DetectedNote[] = [];
    
    // Process the buffer in chunks
    const chunkSize = this.config.dataSize;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      if (chunk.length < chunkSize) break;
      
      this.detector.update(chunk);
      const result = this.detector.getNote();
      
      if (result && result.freq > 0) {
        const noteNumber = (window as any).hzToNote(result.freq);
        const noteStr = (window as any).noteString(noteNumber);
        const octave = Math.floor((noteNumber - 49) / 12) + 4;
        
        results.push({
          note: noteStr.replace(/\d+$/, ''),
          octave: octave,
          frequency: result.freq,
          confidence: result.stable ? 0.9 : 0.5,
          timestamp: Date.now(),
          stable: result.stable
        });
      }
    }
    
    return results;
  }

  destroy(): void {
    this.stopDetection();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export function createNoteDetector(config: NoteDetectorConfig): NoteDetectorWrapper {
  return new NoteDetectorWrapper(config);
}
