export function setupLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger) {
  nk.leaderboardCreate("wins", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  nk.leaderboardCreate("losses", false, "ascending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  nk.leaderboardCreate("draws", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  nk.leaderboardCreate("total_games", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  nk.leaderboardCreate("win_streak", false, "descending" as nkruntime.SortOrder, "best" as nkruntime.Operator);
  nk.leaderboardCreate("score", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  nk.leaderboardCreate("time_played", false, "descending" as nkruntime.SortOrder, "increment" as nkruntime.Operator);
  logger.info("All leaderboards initialized");
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

  const scoreRecords = nk.leaderboardRecordsList("score", undefined, limit, request.cursor);

  const playerIds: string[] = [];
  if (scoreRecords.records) {
    for (const record of scoreRecords.records) {
      if (record.ownerId && playerIds.indexOf(record.ownerId) === -1) {
        playerIds.push(record.ownerId);
      }
    }
  }

  const scoreMap: { [id: string]: number } = {};
  const winsMap: { [id: string]: number } = {};
  const lossesMap: { [id: string]: number } = {};
  const drawsMap: { [id: string]: number } = {};
  const streakMap: { [id: string]: number } = {};
  const timeMap: { [id: string]: number } = {};
  const usernameMap: { [id: string]: string } = {};

  if (scoreRecords.records) {
    for (const r of scoreRecords.records) {
      if (r.ownerId) {
        scoreMap[r.ownerId] = Number(r.score);
        usernameMap[r.ownerId] = r.username || "";
      }
    }
  }

  if (playerIds.length > 0) {
    const boards = ["wins", "losses", "draws", "win_streak", "time_played"];
    const maps = [winsMap, lossesMap, drawsMap, streakMap, timeMap];

    for (let i = 0; i < boards.length; i++) {
      try {
        const records = nk.leaderboardRecordsList(boards[i], playerIds, playerIds.length);
        if (records.records) {
          for (const r of records.records) {
            if (r.ownerId) maps[i][r.ownerId] = Number(r.score);
          }
        }
      } catch (e) {
        logger.warn("Could not fetch %s: %s", boards[i], e);
      }
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
      score: scoreMap[id] || 0,
      timePlayed: timeMap[id] || 0,
    });
  }

  return JSON.stringify({
    entries,
    nextCursor: scoreRecords.nextCursor || null,
    prevCursor: scoreRecords.prevCursor || null,
  });
}
