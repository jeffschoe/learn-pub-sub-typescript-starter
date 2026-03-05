import amqp, { type Channel, type ChannelModel } from "amqplib";


export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
} 

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  try {
    const ch = await conn.createChannel();
    //safe to use `ch` after await
    const queue = await ch.assertQueue(queueName, {
      durable: queueType === SimpleQueueType.Durable,  
      exclusive: queueType !== SimpleQueueType.Durable,
      autoDelete: queueType !== SimpleQueueType.Durable,
    });

    await ch.bindQueue(queueName, exchange, key);

    return [ch, queue];

  } catch (err) {
    throw new Error("failed to create channel/queue", { cause: err as Error })
  }
};

export async function subscribeJSON<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => AckType,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType
  ); //make sure queue exists and is bound to exchange

  await ch.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;

    let data: T;
    try {
      data = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error("Could not unmarshal message:", err);
      return;
    }
    
    try {
      const result = handler(data); // the handler is what actually DOES something with the msg
      switch (result) {
        case AckType.Ack:
          ch.ack(msg);
          console.log('Ack');
          break;
        case AckType.NackRequeue:
          ch.nack(msg, false, true);
          console.log('NackRequeue');
          break;
        case AckType.NackDiscard:
          ch.nack(msg, false, false);
          console.log('NackDiscard');
          break;
        default:
          const unreachable: never = result;
          console.error("Unexpected ack type:", unreachable);
          return;
      }
    } catch (err) {
      console.error("Error handling message:", err);
      ch.nack(msg, false, false);
      return;
    }
    /**RabbitMQ doesn't automatically remove a message from the queue 
     * when it's delivered. It waits for an acknowledgement (ack) from 
     * the consumer, confirming the message was received and processed 
     * successfully. Until you ack it, RabbitMQ holds onto the message 
     * in case the consumer crashes and it needs to be redelivered. */
  });

};

