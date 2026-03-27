/// <reference path="../node_modules/nakama-runtime/index.d.ts" />

import {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
} from "./match_handler";
import { rpcFindMatch } from "./match_rpc";
import { setupLeaderboards, rpcGetLeaderboard } from "./leaderboard";

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  logger.info("Tic-Tac-Toe module loaded");

  initializer.registerMatch("tic-tac-toe", {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });
  logger.info("Match handler 'tic-tac-toe' registered");

  initializer.registerRpc("find_match", rpcFindMatch);
  logger.info("RPC 'find_match' registered");

  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  logger.info("RPC 'get_leaderboard' registered");

  setupLeaderboards(nk, logger);
}

// Prevent esbuild from tree-shaking InitModule (Nakama runtime needs it global)
!InitModule && InitModule.bind(null);
