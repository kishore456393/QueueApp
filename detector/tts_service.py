import asyncio
import base64
from pathlib import Path
from typing import Optional
import io
from gtts import gTTS

# Language mapping for gTTS with slower speech for clarity
VOICE_MAP = {
    'en': 'en',
    'hi': 'hi',
    'ta': 'ta',
    'te': 'te',
    'bn': 'bn',
    'mr': 'mr',
    'gu': 'gu',
    'kn': 'kn',
    'ml': 'ml',
    'pa': 'pa',
}

async def text_to_speech_base64(text: str, language: str = 'en') -> Optional[str]:
    """
    Convert text to speech using Google TTS and return as base64 encoded MP3.
    Uses slower speech rate for better clarity in announcements.
    """
    try:
        lang_code = VOICE_MAP.get(language, 'en')
        
        print(f"[TTS] Generating speech for text: '{text[:50]}...' with language: {lang_code}")
        
        # Create gTTS object with slow=False for normal speed
        tts = gTTS(text=text, lang=lang_code, slow=False)
        
        # Save to BytesIO buffer
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        audio_data = audio_buffer.read()
        
        print(f"[TTS] Generated audio, total size: {len(audio_data)} bytes")
        
        # Encode to base64
        if audio_data:
            encoded = base64.b64encode(audio_data).decode('utf-8')
            print(f"[TTS] Successfully encoded to base64, length: {len(encoded)}")
            return encoded
        else:
            print("[TTS] No audio data generated")
            return None
    except Exception as e:
        print(f"[TTS] Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None
