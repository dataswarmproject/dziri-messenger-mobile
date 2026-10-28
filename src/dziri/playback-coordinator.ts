export type MediaPlayer = { play: () => void; pause: () => void };
const players = new Set<MediaPlayer>();
export function claimPlayback(player: MediaPlayer) {
  for (const other of players) {
    if (other !== player)
      try {
        other.pause();
      } catch {}
  }
}
export function registerPlayback(player: MediaPlayer) {
  players.add(player);
  return () => {
    players.delete(player);
    try {
      player.pause();
    } catch {}
  };
}
