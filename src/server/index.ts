import amqp from "amqplib";

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

}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
