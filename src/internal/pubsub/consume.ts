import amqp, { type Channel } from "amqplib";


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

