"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useAudioPlayer } from "react-use-audio-player";
import { cn } from "../../lib/utils";
import { Button } from "../button/Button";
import { Slider } from "../slider/Slider";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface AudioPlayerProps {
  /** 音频 URL */
  src: string;
  className?: string;
  /** 加载后自动播放 */
  autoPlay?: boolean;
}

/**
 * 基于 react-use-audio-player（Howler.js）与 shadcn Slider / Button 的音频播放器。
 * 参考 shadcn.io Music Mini Player 布局与交互。
 */
export function AudioPlayer({ src, className, autoPlay = false }: AudioPlayerProps) {
  const player = useAudioPlayer(src, {
    html5: true,
    autoplay: autoPlay,
  });

  const {
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    unmute,
    isPlaying,
    isReady,
    isLoading,
    duration,
    volume,
    isMuted,
    error,
    getPosition,
  } = player;

  const [position, setPosition] = useState(0);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    setPosition(0);
    setSeeking(false);
  }, [src]);

  useEffect(() => {
    if (!isPlaying || seeking) return;
    const id = window.setInterval(() => {
      setPosition(getPosition());
    }, 100);
    return () => window.clearInterval(id);
  }, [getPosition, isPlaying, seeking]);

  const handleSeek = useCallback(
    (values: number[]) => {
      const next = values[0] ?? 0;
      setPosition(next);
      seek(next);
    },
    [seek],
  );

  const progressMax = duration > 0 ? duration : 1;
  const progressDisabled = !isReady || duration <= 0 || Boolean(error);

  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm",
        className,
      )}
      role="group"
      aria-label="音频播放器"
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-10 w-10 shrink-0"
        disabled={!isReady || Boolean(error)}
        onClick={togglePlayPause}
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Slider
          value={[Math.min(position, progressMax)]}
          max={progressMax}
          step={0.1}
          disabled={progressDisabled}
          onValueChange={(values) => {
            setSeeking(true);
            setPosition(values[0] ?? 0);
          }}
          onValueCommit={(values) => {
            handleSeek(values);
            setSeeking(false);
          }}
          aria-label="播放进度"
        />
        <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            音频加载失败
          </p>
        ) : null}
      </div>

      <div className="hidden w-28 shrink-0 items-center gap-2 sm:flex">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={!isReady}
          onClick={toggleMute}
          aria-label={isMuted ? "取消静音" : "静音"}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : Math.round(volume * 100)]}
          max={100}
          step={1}
          disabled={!isReady}
          onValueChange={(values) => {
            const next = (values[0] ?? 0) / 100;
            setVolume(Math.max(next, 0.01));
            if (next > 0 && isMuted) unmute();
          }}
          aria-label="音量"
          className="flex-1"
        />
      </div>
    </div>
  );
}
