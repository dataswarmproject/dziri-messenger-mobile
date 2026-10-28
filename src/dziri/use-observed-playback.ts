import { useEffect, useRef } from 'react';
import {
  claimPlayback,
  registerPlayback,
  type MediaPlayer as Player,
} from './playback-coordinator';
/** Resume only playback that our own temporary suspension interrupted. */
export function useObservedPlayback(
  player: Player,
  {
    paused = false,
    autoPlay = false,
    playRequest = 0,
    playing = false,
    onError,
  }: {
    paused?: boolean;
    autoPlay?: boolean;
    playRequest?: number;
    playing?: boolean;
    onError?: () => void;
  },
) {
  const previousPaused = useRef(false),
    resume = useRef(false),
    first = useRef(true),
    lastRequest = useRef(playRequest),
    currentPlaying = useRef(playing);
  currentPlaying.current = playing;
  useEffect(() => {
    first.current = true;
    previousPaused.current = false;
    resume.current = false;
    return registerPlayback(player);
  }, [player]);
  useEffect(() => {
    try {
      if (paused) {
        if (!previousPaused.current) resume.current = currentPlaying.current;
        player.pause();
      } else if (
        (first.current && autoPlay) ||
        resume.current ||
        playRequest !== lastRequest.current
      ) {
        resume.current = false;
        claimPlayback(player);
        player.play();
      }
    } catch {
      onError?.();
    }
    if (!paused) {
      first.current = false;
      lastRequest.current = playRequest;
    }
    previousPaused.current = paused;
  }, [player, paused, autoPlay, playRequest, onError]);
}
