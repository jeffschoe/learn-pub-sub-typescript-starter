import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType } from "../internal/pubsub/consume.js";



export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    handlePause(gs, ps); // paused game for client
    process.stdout.write("> "); // so user can enter a new command
    return AckType.Ack;
  };
};

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
  return (move: ArmyMove): AckType => {
    const outcome = handleMove(gs, move); 
    //console.log(`Player ${move.player.username} moved ${move.units.length} units to ${move.toLocation}`);
    
    try {
      switch (outcome) {
        case MoveOutcome.SamePlayer:
          return AckType.NackDiscard;
        case MoveOutcome.Safe:
          return AckType.Ack;
        case MoveOutcome.MakeWar:
          return AckType.Ack;
        default:
          return AckType.NackDiscard;
      }
    } finally { // runs no matter how the try block exits - whether by return, throw, or normal completion. That way the prompt always gets written
      process.stdout.write("> "); // so user can enter a new command
    }
    
    

    
  };
};

