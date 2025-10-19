import { avatarTTS } from './avatarTTS';

// Example usage of the avatar TTS function
export async function exampleUsage() {
  try {
    // Example 1: Hagrid speaking
    await avatarTTS.speakAsAvatar(
      "Great job on that scale! You're improving every day.",
      "hagrid"
    );

    // Example 2: Snape speaking
    await avatarTTS.speakAsAvatar(
      "Your technique needs work. Focus on precision.",
      "snape"
    );

    // Example 3: Dumbledore speaking
    await avatarTTS.speakAsAvatar(
      "Music requires both discipline and heart. Trust in your ability to learn.",
      "dumbledore"
    );

    // Example 4: Dobby speaking
    await avatarTTS.speakAsAvatar(
      "You're doing wonderfully! Dobby is so proud of your progress!",
      "dobby"
    );

  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Function to test with custom text
export async function testAvatarTTS(text: string, avatarId: string) {
  try {
    console.log(`Speaking as ${avatarId}: "${text}"`);
    await avatarTTS.speakAsAvatar(text, avatarId);
    console.log('Speech completed successfully');
  } catch (error) {
    console.error('Error in testAvatarTTS:', error);
  }
}

// Get available avatars
export function getAvailableAvatars() {
  return avatarTTS.getAvailableAvatars();
}
