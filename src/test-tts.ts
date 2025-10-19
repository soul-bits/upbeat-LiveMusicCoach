// Test file to debug TTS setup
import { avatarTTS } from './avatarTTS';

export async function testTTS() {
  console.log('=== TTS Debug Test ===');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('VITE_ELEVENLABS_API_KEY:', import.meta.env.VITE_ELEVENLABS_API_KEY ? 'SET' : 'NOT SET');
  console.log('VITE_GEMINI_API_KEY:', import.meta.env.VITE_GEMINI_API_KEY ? 'SET' : 'NOT SET');
  
  // Check if avatars are loaded
  const avatars = avatarTTS.getAvailableAvatars();
  console.log('Available avatars:', avatars);
  
  if (avatars.length === 0) {
    console.error('No avatars loaded! Check if /avatars/avatar.json exists and is accessible.');
    return;
  }
  
  // Test with first avatar
  const testAvatar = avatars[0];
  console.log('Testing with avatar:', testAvatar);
  
  try {
    console.log('Attempting to speak test message...');
    await avatarTTS.speakAsAvatar('Hello! This is a test of the text to speech system.', testAvatar.id);
    console.log('TTS test completed successfully!');
  } catch (error) {
    console.error('TTS test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

// Auto-run test when imported
if (typeof window !== 'undefined') {
  // Only run in browser
  setTimeout(() => {
    testTTS();
  }, 1000);
}
