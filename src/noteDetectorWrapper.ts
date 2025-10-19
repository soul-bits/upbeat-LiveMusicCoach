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
    // Load the JavaScript modules
    await this.loadScripts();
    
    // Initialize the detector after scripts are loaded
    this.detector = new (window as any).NoteDetector(
      this.config.dataSize,
      this.config.sampleRate,
      this.config.windowType
    );
    
    // Initialize audio context
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.config.sampleRate
    });
  }

  private async loadScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if scripts are already loaded
      if (typeof (window as any).NoteDetector !== 'undefined' && typeof (window as any).hzToNote !== 'undefined') {
        resolve();
        return;
      }

      // Load note-utils.js
      const utilsScript = document.createElement('script');
      utilsScript.src = '/src/note-utils.js';
      utilsScript.onload = () => {
        // Load note-detector.js
        const detectorScript = document.createElement('script');
        detectorScript.src = '/src/note-detector.js';
        detectorScript.onload = () => {
          resolve();
        };
        detectorScript.onerror = () => reject(new Error('Failed to load note-detector.js'));
        document.head.appendChild(detectorScript);
      };
      utilsScript.onerror = () => reject(new Error('Failed to load note-utils.js'));
      document.head.appendChild(utilsScript);
    });
  }

  connectAudioSource(stream: MediaStream): void {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.dataSize * 2;
    this.analyser.smoothingTimeConstant = 0.8;

    source.connect(this.analyser);
    this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
  }

  startDetection(): void {
    if (this.isDetecting) return;
    
    this.isDetecting = true;
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
    if (!this.isDetecting || !this.analyser || !this.dataArray) return;

    // Get audio data
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Process with note detector
    this.detector.update(this.dataArray);
    
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
