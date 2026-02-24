import { useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export function useAudioPlayer() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudioPlayer must be used within an AudioProvider');
  }
  return ctx;
}
