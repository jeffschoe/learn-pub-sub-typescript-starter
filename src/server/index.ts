import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeMsgPack } from "../internal/pubsub/consume.js";
import { handlerLog } from "./handlers.js";

async function main() {
  console.log("Starting Peril server...");
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

  const queueName = GameLogSlug;
  const queueKey = `${GameLogSlug}.*`;

  await subscribeMsgPack(
    conn,
    ExchangePerilTopic,
    queueName,
    queueKey,
    SimpleQueueType.Durable,
    handlerLog(),
  )

  // Used to run the server from a non-interactive source, like the multiserver.sh file
  if (!process.stdin.isTTY) {
    console.log("Non-interactive mode: skipping command input.");
    return;
  }

  printServerHelp();

  while(true) {
    const words = await getInput();
    if (words.length === 0) continue; // retry loop
    const command = words[0];

    switch (command) {
      case "pause":
        console.log("sending pause message");
        try {
          await publishJSON(
            publishCh, 
            ExchangePerilDirect, 
            PauseKey, 
            {isPaused: true} satisfies PlayingState
          )
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "resume":
        console.log("sending resume message");
        try {
          await publishJSON(
            publishCh, 
            ExchangePerilDirect, 
            PauseKey, 
            {isPaused: false} satisfies PlayingState
          )
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "quit":
        console.log("exiting... Goodbye!");
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
