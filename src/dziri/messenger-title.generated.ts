'use client';

// One-shot adaptation of Magic UI's TypingAnimation timer sequence.
// https://magicui.design/docs/components/typing-animation
// Copyright (c) Magic UI, MIT. See packages/ui/licenses/magic-ui.txt.
import { useEffect, useState } from 'react';

type Frame = { text: string; cursor: boolean; delay: number };

function frames(title: string): Frame[] {
  const name = Array.from(title);
  const result: Frame[] = [{ text: '', cursor: true, delay: 120 }];
  for (let n = 1; n <= name.length; n++)
    result.push({
      text: name.slice(0, n).join(''),
      cursor: true,
      delay: n === name.length ? 1100 : 60,
    });
  // Keep the common D while contracting an English/French brand name.
  const retained = name[0] === 'D' ? 1 : 0;
  for (let n = name.length - 1; n >= retained; n--)
    result.push({
      text: name.slice(0, n).join(''),
      cursor: true,
      delay: n === retained ? 60 : 30,
    });
  if (!retained) result.push({ text: 'D', cursor: true, delay: 60 });
  result.push({ text: 'DM', cursor: false, delay: 0 });
  return result;
}

/** null waits for the platform preference; true has no animation or timers. */
export function useMessengerTitle(title: string, reducedMotion: boolean | null) {
  const [frame, setFrame] = useState({
    source: title,
    text: '',
    cursor: false,
  });
  useEffect(() => {
    if (reducedMotion !== false) return;
    const sequence = frames(title);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    let index = 0;
    const advance = () => {
      if (!active) return;
      const next = sequence[index++];
      setFrame({ source: title, text: next.text, cursor: next.cursor });
      if (index < sequence.length) timer = setTimeout(advance, next.delay);
    };
    advance();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [title, reducedMotion]);
  if (reducedMotion) return { text: 'DM', cursor: false };
  if (reducedMotion === null || frame.source !== title) return { text: '', cursor: false };
  return { text: frame.text, cursor: frame.cursor };
}
