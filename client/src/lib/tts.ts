export async function playTextToSpeech(text: string, language: string = 'en'): Promise<void> {
  const detectorBaseUrl = (import.meta.env.VITE_DETECTOR_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

  // Try server TTS first (Google TTS - works reliably with all languages)
  try {
    const response = await fetch(`${detectorBaseUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      throw new Error('TTS request failed');
    }

    const data = await response.json();
    
    if (data.audio_b64) {
      // Convert base64 to blob
      const audioData = atob(data.audio_b64);
      const bytes = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        bytes[i] = audioData.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      await audio.play();
      
      // Cleanup
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      return;
    } else if (data.error) {
      console.warn('Server TTS error:', data.error);
      throw new Error(data.error);
    }
  } catch (error) {
    console.warn('Server TTS failed, trying browser TTS:', error);
  }
  
  // Fallback to browser's Web Speech API
  if ('speechSynthesis' in window) {
    try {
      return await playBrowserTTS(text, language);
    } catch (error) {
      console.error('Browser TTS also failed:', error);
      throw error;
    }
  } else {
    throw new Error('No TTS method available');
  }
}

async function playBrowserTTS(text: string, language: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map language codes to browser voice languages
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'bn': 'bn-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'pa': 'pa-IN',
    };
    
    utterance.lang = langMap[language] || 'en-US';
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 0.8; // Lower pitch for more masculine sound
    utterance.volume = 1.0;
    
    // Try to find a male voice for the language
    const voices = window.speechSynthesis.getVoices();
    const targetLang = utterance.lang.split('-')[0];
    
    // First try: Find male voice with exact language match
    let selectedVoice = voices.find(v => 
      v.lang.startsWith(targetLang) && 
      (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man'))
    );
    
    // Second try: Find any male voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man')
      );
    }
    
    // Third try: Find any voice for the language
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith(targetLang));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
    }
    
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      reject(new Error(`Speech synthesis failed: ${event.error}`));
    };
    
    window.speechSynthesis.speak(utterance);
  });
}
