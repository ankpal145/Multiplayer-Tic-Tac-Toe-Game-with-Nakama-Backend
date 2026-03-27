export function setupLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger) {
  nk.leaderboardCreate("wins", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'wins' created");

  nk.leaderboardCreate("losses", false, "ascending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'losses' created");

  nk.leaderboardCreate("draws", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'draws' created");

  nk.leaderboardCreate("total_games", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'total_games' created");

  nk.leaderboardCreate("win_streak", false, "descending" as nkruntime.SortOrder, "best" as nkruntime.Operator);
  logger.info("Leaderboard 'win_streak' created");
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

  const totalRecords = nk.leaderboardRecordsList("total_games", undefined, limit, request.cursor);

  const playerIds: string[] = [];
  if (totalRecords.records) {
    for (const record of totalRecords.records) {
      if (record.ownerId && playerIds.indexOf(record.ownerId) === -1) {
        playerIds.push(record.ownerId);
      }
    }
  }

  const winsMap: { [id: string]: number } = {};
  const lossesMap: { [id: string]: number } = {};
  const drawsMap: { [id: string]: number } = {};
  const streakMap: { [id: string]: number } = {};
  const usernameMap: { [id: string]: string } = {};

  if (totalRecords.records) {
    for (const r of totalRecords.records) {
      if (r.ownerId) {
        usernameMap[r.ownerId] = r.username || "";
      }
    }
  }

  if (playerIds.length > 0) {
    try {
      const records = nk.leaderboardRecordsList("wins", playerIds, playerIds.length);
      if (records.records) {
        for (const r of records.records) {
          if (r.ownerId) winsMap[r.ownerId] = Number(r.score);
        }
      }
    } catch (e) {
      logger.warn("Could not fetch wins: %s", e);
    }

    try {
      const records = nk.leaderboardRecordsList("losses", playerIds, playerIds.length);
      if (records.records) {
        for (const r of records.records) {
          if (r.ownerId) lossesMap[r.ownerId] = Number(r.score);
        }
      }
    } catch (e) {
      logger.warn("Could not fetch losses: %s", e);
    }

    try {
      const records = nk.leaderboardRecordsList("draws", playerIds, playerIds.length);
      if (records.records) {
        for (const r of records.records) {
          if (r.ownerId) drawsMap[r.ownerId] = Number(r.score);
        }
      }
    } catch (e) {
      logger.warn("Could not fetch draws: %s", e);
    }

    try {
      const records = nk.leaderboardRecordsList("win_streak", playerIds, playerIds.length);
      if (records.records) {
        for (const r of records.records) {
          if (r.ownerId) streakMap[r.ownerId] = Number(r.score);
        }
      }
    } catch (e) {
      logger.warn("Could not fetch streaks: %s", e);
    }
  }

  const entries: any[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const wins = winsMap[id] || 0;
    const losses = lossesMap[id] || 0;
    const draws = drawsMap[id] || 0;
    entries.push({
      rank: i + 1,
      userId: id,
      username: usernameMap[id] || "",
      wins,
      losses,
      draws,
      totalGames: wins + losses + draws,
      winStreak: streakMap[id] || 0,
    });
  }

  return JSON.stringify({
    entries,
    nextCursor: totalRecords.nextCursor || null,
    prevCursor: totalRecords.prevCursor || null,
  });
}
