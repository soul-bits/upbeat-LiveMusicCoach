/// <reference types="vite/client" />
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

interface Avatar {
  id: string;
  name: string;
  voice_id: string;
  system_prompt: string;
  avatar_url: string;
  personality: string;
  quote: string;
}

class AvatarTTS {
  private elevenlabs: ElevenLabsClient;
  private avatars: Avatar[] = [];

  constructor() {
    this.elevenlabs = new ElevenLabsClient({
      apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
    });
    this.loadAvatars();
  }

  private async loadAvatars() {
    try {
      const response = await fetch('/avatars/avatar.json');
      this.avatars = await response.json();
    } catch (error) {
      console.error('Failed to load avatars:', error);
    }
  }

  private getAvatarById(avatarId: string): Avatar | null {
    return this.avatars.find(avatar => avatar.id === avatarId) || null;
  }

  private async convertToAvatarStyle(textResponse: string, avatarId: string): Promise<string> {
    const avatar = this.getAvatarById(avatarId);
    if (!avatar) {
      throw new Error(`Avatar with id "${avatarId}" not found`);
    }

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `You are ${avatar.name}. ${avatar.system_prompt}

Please convert the following text response to match your personality and speaking style. Keep the core message the same but adapt the tone, vocabulary, and mannerisms to match your character:

Original text: "${textResponse}"

Respond with only the converted text, no additional commentary.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
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
      return data.candidates?.[0]?.content?.parts?.[0]?.text || textResponse;
    } catch (error) {
      console.error('Error converting text to avatar style:', error);
      return textResponse; // Fallback to original text
    }
  }

  private async speakWithElevenLabs(text: string, voiceId: string): Promise<void> {
    try {
      const audio = await this.elevenlabs.textToSpeech.convert(
        voiceId,
        {
          text: text,
          modelId: 'eleven_multilingual_v2',
          outputFormat: 'mp3_44100_128',
        }
      );

      // Convert ReadableStream to Uint8Array, then to Blob for browser Audio API
      const reader = audio.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const audioData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }
      
      const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioUrl);
      
      return new Promise((resolve, reject) => {
        audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audioElement.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };
        audioElement.play().catch(reject);
      });
    } catch (error) {
      console.error('Error with Eleven Labs TTS:', error);
      throw error;
    }
  }

  /**
   * Main function to convert text to avatar style and speak it
   * @param textResponse - The original text response to convert
   * @param avatarId - The ID of the avatar to use for style conversion and voice
   * @returns Promise<void>
   */
  async speakAsAvatar(textResponse: string, avatarId: string): Promise<void> {
    try {
      // Ensure avatars are loaded
      if (this.avatars.length === 0) {
        await this.loadAvatars();
      }

      const avatar = this.getAvatarById(avatarId);
      if (!avatar) {
        throw new Error(`Avatar with id "${avatarId}" not found`);
      }

      // Convert text to avatar style using Gemini
      const convertedText = await this.convertToAvatarStyle(textResponse, avatarId);
      
      // Speak the converted text using Eleven Labs
      await this.speakWithElevenLabs(convertedText, avatar.voice_id);
      
    } catch (error) {
      console.error('Error in speakAsAvatar:', error);
      throw error;
    }
  }

  /**
   * Get all available avatars
   */
  getAvailableAvatars(): Avatar[] {
    return this.avatars;
  }

  /**
   * Get a specific avatar by ID
   */
  getAvatar(avatarId: string): Avatar | null {
    return this.getAvatarById(avatarId);
  }
}

// Export a singleton instance
export const avatarTTS = new AvatarTTS();

// Export the class for custom instances
export { AvatarTTS };
export type { Avatar };
