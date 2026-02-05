/**
 * Location: features/assignments/components/ielts/TimerPreview.tsx
 * Purpose: Visual countdown timer preview for IELTS Speaking Part 2 timing.
 * Why: Helps teachers understand what students will see during the actual test.
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerPreviewProps {
  seconds: number;
  label: string;
  variant: 'prep' | 'talk';
  isActive?: boolean;
}

/**
 * Format seconds into MM:SS display
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Circular progress timer that shows what students will see during the test.
 * Displays time remaining in MM:SS format with a circular progress indicator.
 */
export function TimerPreview({
  seconds,
  label,
  variant,
  isActive = false,
}: TimerPreviewProps) {
  const [displayTime, setDisplayTime] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);

  // Update display time when props change (but not while running)
  useEffect(() => {
    if (!isRunning) {
      setDisplayTime(seconds);
    }
  }, [seconds, isRunning]);

  // Countdown effect when active
  useEffect(() => {
    if (!isRunning || displayTime <= 0) return;

    const interval = setInterval(() => {
      setDisplayTime((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, displayTime]);

  const handleToggle = () => {
    if (displayTime <= 0) {
      setDisplayTime(seconds);
      setIsRunning(false);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setDisplayTime(seconds);
  };

  // Calculate progress for circular indicator
  const progress = seconds > 0 ? ((seconds - displayTime) / seconds) * 100 : 0;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color based on variant and time remaining
  const getColor = () => {
    if (variant === 'prep') return '#2563EB'; // IELTS blue
    // Talk phase: green -> yellow -> red as time runs out
    const percentage = displayTime / seconds;
    if (percentage > 0.5) return '#22C55E'; // green
    if (percentage > 0.25) return '#EAB308'; // yellow
    return '#EF4444'; // red
  };

  const color = getColor();
  const isWarning = displayTime / seconds <= 0.25 && displayTime > 0;

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-[12px] border border-border bg-card">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="size-4 text-muted-foreground" />
        {label}
      </div>

      {/* Circular Timer Display */}
      <div className="relative">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Time display in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-2xl font-bold tabular-nums ${
              isWarning ? 'text-red-500 animate-pulse' : 'text-foreground'
            }`}
          >
            {formatTime(displayTime)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isRunning ? 'Running' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isRunning ? 'Pause' : displayTime === 0 ? 'Restart' : 'Start'}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Time info */}
      <div className="text-xs text-muted-foreground text-center">
        Total: {formatTime(seconds)}
      </div>
    </div>
  );
}

/**
 * Compact timer display for use in preview cards.
 * Shows just the time without interactive controls.
 */
export function TimerDisplay({
  seconds,
  label,
  variant,
}: Omit<TimerPreviewProps, 'isActive'>) {
  const color = variant === 'prep' ? '#2563EB' : '#22C55E';

  return (
    <div className="flex items-center gap-3 p-3 rounded-[10px] border border-border bg-muted/20">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full"
        style={{ backgroundColor: `${color}20` }}
      >
        <Clock className="size-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{formatTime(seconds)}</p>
      </div>
    </div>
  );
}
