export function rpcFindMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let request: { mode?: string } = {};
  if (payload && payload.length > 0) {
    try {
      request = JSON.parse(payload);
    } catch (e) {
      logger.error("Invalid find_match payload: %s", payload);
    }
  }

  const mode = request.mode || "classic";
  const query = `+label.open:1 +label.mode:${mode}`;

  // Try multiple times to find an open match to reduce race conditions
  for (let attempt = 0; attempt < 3; attempt++) {
    const matches = nk.matchList(10, true, null, null, 1, query);
    if (matches.length > 0) {
      logger.info("Found existing match: %s (attempt %d)", matches[0].matchId, attempt);
      return JSON.stringify({ matchIds: [matches[0].matchId] });
    }

    if (attempt === 0) {
      const matchId = nk.matchCreate("tic-tac-toe", { mode });
      logger.info("Created new match: %s (mode: %s)", matchId, mode);
      return JSON.stringify({ matchIds: [matchId] });
    }
  }

  const matchId = nk.matchCreate("tic-tac-toe", { mode });
  logger.info("Created new match after retries: %s (mode: %s)", matchId, mode);
  return JSON.stringify({ matchIds: [matchId] });
}
