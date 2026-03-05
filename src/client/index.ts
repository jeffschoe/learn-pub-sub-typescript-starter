import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";

import { handlerPause } from "./handlers.js";


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
  const queueName = `${PauseKey}.${userName}`;

  const gs = new GameState(userName);

  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    queueName,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs),
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
          const result = commandMove(gs, words);
          console.log("move successful")
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
