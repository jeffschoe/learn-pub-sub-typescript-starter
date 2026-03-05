import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";



export function handlerPause(gs: GameState): (ps: PlayingState) => void {
  return (ps: PlayingState) => {
    handlePause(gs, ps); // paused game for client
    process.stdout.write("> "); // so user can enter a new command
  };
};

export function handlerMove(gs: GameState): (move: ArmyMove) => void {
  return (move: ArmyMove) => {
    handleMove(gs, move); 
    console.log(`Player ${move.player.username} moved ${move.units.length} units to ${move.toLocation}`);
    process.stdout.write("> "); // so user can enter a new command
  };
};

