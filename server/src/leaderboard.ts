export function setupLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger) {
  nk.leaderboardCreate("wins", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'wins' created");

  nk.leaderboardCreate("losses", false, "ascending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("Leaderboard 'losses' created");

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

  const winsRecords = nk.leaderboardRecordsList("wins", undefined, limit, request.cursor);

  const playerIds: string[] = [];
  if (winsRecords.records) {
    for (const record of winsRecords.records) {
      if (record.ownerId && playerIds.indexOf(record.ownerId) === -1) {
        playerIds.push(record.ownerId);
      }
    }
  }

  // Fetch losses and streaks for the same players
  const lossesMap: { [id: string]: number } = {};
  const streakMap: { [id: string]: number } = {};

  if (playerIds.length > 0) {
    try {
      const lossRecords = nk.leaderboardRecordsList("losses", playerIds, playerIds.length);
      if (lossRecords.records) {
        for (const r of lossRecords.records) {
          if (r.ownerId) {
            lossesMap[r.ownerId] = Number(r.score);
          }
        }
      }
    } catch (e) {
      logger.warn("Could not fetch losses: %s", e);
    }

    try {
      const streakRecords = nk.leaderboardRecordsList("win_streak", playerIds, playerIds.length);
      if (streakRecords.records) {
        for (const r of streakRecords.records) {
          if (r.ownerId) {
            streakMap[r.ownerId] = Number(r.score);
          }
        }
      }
    } catch (e) {
      logger.warn("Could not fetch streaks: %s", e);
    }
  }

  const entries: any[] = [];
  if (winsRecords.records) {
    for (let i = 0; i < winsRecords.records.length; i++) {
      const r = winsRecords.records[i];
      entries.push({
        rank: i + 1,
        userId: r.ownerId,
        username: r.username,
        wins: Number(r.score),
        losses: lossesMap[r.ownerId || ""] || 0,
        winStreak: streakMap[r.ownerId || ""] || 0,
      });
    }
  }

  return JSON.stringify({
    entries,
    nextCursor: winsRecords.nextCursor || null,
    prevCursor: winsRecords.prevCursor || null,
  });
}
