import amqp from "amqplib";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType } from "../internal/pubsub/consume.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";



export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    handlePause(gs, ps); // paused game for client
    process.stdout.write("> "); // so user can enter a new command
    return AckType.Ack;
  };
};

export function handlerMove(
  gs: GameState, 
  publishCh: amqp.ConfirmChannel, 
): (move: ArmyMove) => Promise<AckType> {
  return async (move: ArmyMove): Promise<AckType> => {
    const outcome = handleMove(gs, move); 
    
    try {
      switch (outcome) {
        case MoveOutcome.Safe:
        case MoveOutcome.SamePlayer:
          return AckType.Ack;
        case MoveOutcome.MakeWar:
          const rw: RecognitionOfWar = {
              attacker: move.player,
              defender: gs.getPlayerSnap(),
            }

          try {
            await publishJSON(
              publishCh, 
              ExchangePerilTopic, 
              `${WarRecognitionsPrefix}.${gs.getUsername()}`,
              rw,
            )
          } catch (err) {
            console.error("Error publishing war recognition:", err);
          } finally  {
            return AckType.NackRequeue;
          }
        default:
          return AckType.NackDiscard;
      }
    } finally { // runs no matter how the try block exits - whether by return, throw, or normal completion. That way the prompt always gets written
      process.stdout.write("> "); // so user can enter a new command
    }    
  };
};

export function handlerWar(
  gs: GameState
): (war: RecognitionOfWar) => Promise<AckType> {
  return async (war: RecognitionOfWar): Promise<AckType> => {

    try {
      const outcome = handleWar(gs, war);

      switch (outcome.result) {
      case WarOutcome.NotInvolved:
        return AckType.NackRequeue;
      case WarOutcome.NoUnits:
        return AckType.NackDiscard;
      case WarOutcome.YouWon:
      case WarOutcome.OpponentWon:
      case WarOutcome.Draw:
        return AckType.Ack;
      default:
        const unreachable: never = outcome;
        console.log("Unexpected war resolution: ", unreachable);
        return AckType.NackDiscard;
    }
    } finally {
      process.stdout.write("> "); // so user can enter a new command
    }
    
  };
  
}

