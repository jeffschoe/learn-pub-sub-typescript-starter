import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, getMaliciousLog, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";

import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import type { GameLog } from "../internal/gamelogic/logs.js";


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

  const publishCh = await conn.createConfirmChannel();
  const userName = await clientWelcome(); //promt user for user name
  const gs = new GameState(userName);
  

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
    handlerMove(gs, publishCh),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    WarRecognitionsPrefix,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gs, publishCh)
  )

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
          try {
            await publishJSON(
              publishCh, 
              ExchangePerilTopic, 
              `${ArmyMovesPrefix}.${userName}`, 
              move
            )
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
        if (words.length < 2) {
          console.log("usage: spam <n>");
          break;
        }
        const secondWord = words[1];
        if (!secondWord) {
          console.log("usage: spam <n>");
          break;
        }

        let spamCount;
        try {
          spamCount = parseInt(secondWord);
        } catch(err) {
          console.error("command format: spam <int>, please try again", err);
          break;
        }

       
        for(let i = 0; i< spamCount; i++) {
          try {
            await publishGameLog(
              publishCh, 
              gs.getUsername(), 
              getMaliciousLog()
            );
            console.log(`Published ${spamCount} malicious logs`);
          } catch (err) {
            console.error("Error publishing message:", err);
          }
        }

        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.log("Unknown command, please try again");
    }
  }
}

 export function publishGameLog(
    publishCh: amqp.ConfirmChannel,
    username: string,
    message: string,
  ) {
    const log: GameLog = {
      username: username,
      message,
      currentTime: new Date()
    }

    return publishMsgPack(
      publishCh,
      ExchangePerilTopic,
      `${GameLogSlug}.${username}`,
      log
    )
  }


main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
