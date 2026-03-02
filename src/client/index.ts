import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");
  
    const rabbitConnString = "amqp://guest:guest@localhost:5672/"; //This is how the application knows where to connect to the RabbitMQ server
    const conn = await amqp.connect(rabbitConnString); //create a new connection to RabbitMQ
    console.log("Peril game server connected to RabbitMQ!");

    const userName = await clientWelcome(); //promt user for user name
    const queueName = `${PauseKey}.${userName}`;

    await declareAndBind(conn, ExchangePerilDirect, queueName, PauseKey, SimpleQueueType.Transient)
}



main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
