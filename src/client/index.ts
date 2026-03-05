import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";

import { handlerMove, handlerPause } from "./handlers.js";
import { publishJSON } from "../internal/pubsub/publish.js";


async function main() {
  console.log("Starting Peril client...");
  
  const rabbitConnString = "amqp://guest:guest@localhost:5672/"; //This is how the application knows where to connect to the RabbitMQ server
  const conn = await amqp.connect(rabbitConnString); //create a new connection to RabbitMQ
  console.log("Peril game server connected to RabbitMQ!");

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const userName = await clientWelcome(); //promt user for user name
  const gs = new GameState(userName);
  const publishCh = await conn.createConfirmChannel();


  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${userName}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${userName}`,
    `${ArmyMovesPrefix}.*`, //wildcard key
    SimpleQueueType.Transient,
    handlerMove(gs),
  );

  while(true) {
    const words = await getInput();
    if (words.length === 0) continue; // retry loop
    const command = words[0];

    switch (command) {
      case "spawn":
        try {
          commandSpawn(gs, words);
        } catch (err) {
          console.error("Error sending spawn message:", err);
        }
        break;
      case "move":
        try {
          const move = commandMove(gs, words);
          //console.log("move successful")
          try {
            await publishJSON(
              publishCh, 
              ExchangePerilTopic, 
              `${ArmyMovesPrefix}.${userName}`, 
              move
            )
            //console.log("move published successfully")
          } catch (err) {
            console.error("Error publishing message:", err);
          }
        } catch (err) {
          console.error("move not successful:", err);
        }
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        console.log("Spamming now allowed yet!")
        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.log("Unknown command, please try again");
    }
  }
}



main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
