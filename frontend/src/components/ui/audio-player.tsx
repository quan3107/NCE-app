/**
 * Location: components/ui/audio-player.tsx
 * Purpose: Audio player component with controls and progress bar.
 * Why: Provides consistent audio preview UI across the application.
 */

import { Play, Pause } from 'lucide-react';
import { Button } from './button';
import { Slider } from './slider';
import { cn } from './utils';
import { useAudioMetadata, formatFileSize } from '@lib/use-audio-metadata';

interface AudioPlayerProps {
  audioUrl: string | null;
  fileName?: string;
  fileSize?: number;
  className?: string;
}

export function AudioPlayer({ audioUrl, fileName, fileSize, className }: AudioPlayerProps) {
  const { metadata, toggle, seek, formatTime } = useAudioMetadata(audioUrl);

  if (!audioUrl) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* File info */}
      {(fileName || fileSize) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {fileName && <span className="font-medium">{fileName}</span>}
          {fileSize && <span>({formatFileSize(fileSize)})</span>}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          onClick={toggle}
          disabled={!metadata.isLoaded}
        >
          {metadata.isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        <div className="flex-1 space-y-1">
          <Slider
            value={[metadata.currentTime]}
            max={metadata.duration || 100}
            step={1}
            onValueChange={([value]) => seek(value)}
            disabled={!metadata.isLoaded}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(metadata.currentTime)}</span>
            <span>{formatTime(metadata.duration)}</span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {metadata.error && (
        <p className="text-sm text-destructive">{metadata.error}</p>
      )}
    </div>
  );
}
