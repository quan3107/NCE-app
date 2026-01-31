/**
 * Location: lib/use-audio-metadata.ts
 * Purpose: Hook for getting audio file metadata and controlling playback.
 * Why: Provides audio preview functionality for listening assignments.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioMetadata {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isLoaded: boolean;
  error: string | null;
}

interface UseAudioMetadataReturn {
  metadata: AudioMetadata;
  audioRef: React.RefObject<HTMLAudioElement>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  formatTime: (seconds: number) => string;
}

export function useAudioMetadata(audioUrl: string | null): UseAudioMetadataReturn {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [metadata, setMetadata] = useState<AudioMetadata>({
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    isLoaded: false,
    error: null,
  });

  // Load audio metadata when URL changes
  useEffect(() => {
    if (!audioUrl) {
      setMetadata({
        duration: 0,
        currentTime: 0,
        isPlaying: false,
        isLoaded: false,
        error: null,
      });
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setMetadata((prev) => ({
        ...prev,
        duration: audio.duration,
        isLoaded: true,
        error: null,
      }));
    };

    const handleTimeUpdate = () => {
      setMetadata((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleEnded = () => {
      setMetadata((prev) => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
      }));
    };

    const handleError = () => {
      setMetadata((prev) => ({
        ...prev,
        error: 'Failed to load audio',
        isLoaded: false,
      }));
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Load the audio
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setMetadata((prev) => ({ ...prev, isPlaying: true }));
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setMetadata((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const toggle = useCallback(() => {
    if (metadata.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [metadata.isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, metadata.duration));
      setMetadata((prev) => ({ ...prev, currentTime: audioRef.current!.currentTime }));
    }
  }, [metadata.duration]);

  const formatTime = useCallback((seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    metadata,
    audioRef,
    play,
    pause,
    toggle,
    seek,
    formatTime,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
