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

  // Search for an open match of the requested mode
  const query = `+label.open:1 +label.mode:${mode}`;
  const matches = nk.matchList(10, true, null, null, 1, query);

  if (matches.length > 0) {
    logger.info("Found existing match: %s", matches[0].matchId);
    return JSON.stringify({ matchIds: [matches[0].matchId] });
  }

  // No open match found, create a new one
  const matchId = nk.matchCreate("tic-tac-toe", { mode });
  logger.info("Created new match: %s (mode: %s)", matchId, mode);
  return JSON.stringify({ matchIds: [matchId] });
}
