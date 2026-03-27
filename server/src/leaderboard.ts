export function setupLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger) {
  nk.leaderboardCreate(
    "player_ranking",
    false,
    "descending" as nkruntime.SortOrder,
    "set" as nkruntime.Operator
  );
  logger.info("Leaderboard 'player_ranking' initialized");
}

export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let request: { limit?: number; cursor?: string } = {};
  if (payload && payload.length > 0) {
    try {
      request = JSON.parse(payload);
    } catch (e) {
      logger.error("Invalid get_leaderboard payload: %s", payload);
    }
  }

  const limit = request.limit || 20;

  const rankings = nk.leaderboardRecordsList("player_ranking", undefined, limit, request.cursor);

  const playerIds: string[] = [];
  if (rankings.records) {
    for (const record of rankings.records) {
      if (record.ownerId && playerIds.indexOf(record.ownerId) === -1) {
        playerIds.push(record.ownerId);
      }
    }
  }

  if (playerIds.length === 0) {
    return JSON.stringify({ entries: [], nextCursor: null, prevCursor: null });
  }

  const statsMap: { [id: string]: any } = {};
  try {
    const readOps: nkruntime.StorageReadRequest[] = playerIds.map(id => ({
      collection: "player_stats",
      key: "stats",
      userId: id,
    }));
    const objects = nk.storageRead(readOps);
    if (objects) {
      for (const obj of objects) {
        if (obj.userId) {
          statsMap[obj.userId] = obj.value;
        }
      }
    }
  } catch (e) {
    logger.warn("Could not read player_stats: %s", e);
  }

  const nameMap: { [id: string]: string } = {};
  try {
    const accounts = nk.accountsGetId(playerIds);
    if (accounts) {
      for (const acc of accounts) {
        if (acc.user) {
          nameMap[acc.user.id] = acc.user.displayName || acc.user.username || "Player";
        }
      }
    }
  } catch (e) {
    logger.warn("Could not fetch accounts: %s", e);
  }

  const entries: any[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const s = statsMap[id] || {};
    const wins = Number(s.wins) || 0;
    const losses = Number(s.losses) || 0;
    const draws = Number(s.draws) || 0;

    entries.push({
      rank: i + 1,
      userId: id,
      username: nameMap[id] || "Player",
      wins,
      losses,
      draws,
      totalGames: wins + losses + draws,
      winStreak: Number(s.bestStreak) || 0,
      score: Number(s.score) || 0,
      timePlayed: Number(s.timePlayed) || 0,
    });
  }

  return JSON.stringify({
    entries,
    nextCursor: rankings.nextCursor || null,
    prevCursor: rankings.prevCursor || null,
  });
}
