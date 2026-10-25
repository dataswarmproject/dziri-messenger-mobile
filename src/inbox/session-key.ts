// Tuples avoid origin/user delimiter collisions; no fallback to a prior user's vault entry.
export function inboxSessionScope(origin: string, identityScope: string) {
  return JSON.stringify(['inbox', origin, identityScope]);
}
