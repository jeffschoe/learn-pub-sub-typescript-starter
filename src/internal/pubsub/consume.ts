import amqp, { type Channel, type ChannelModel } from "amqplib";
import { decode } from "@msgpack/msgpack"


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
      arguments: { 
        "x-dead-letter-exchange": "peril_dlx" 
      }  
    });

    await ch.bindQueue(queueName, exchange, key);

    return [ch, queue];

  } catch (err) {
    throw new Error("failed to create channel/queue", { cause: err as Error })
  }
};

export async function subscribe<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    queueType
  ); //make sure queue exists and is bound to exchange

  await ch.consume(queue.queue, async (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;

    let data: T;
    try {
      data = unmarshaller(msg.content);
    } catch (err) {
      console.error("Could not unmarshal message:", err);
      ch.nack(msg, false, false);
      return;
    }
    
    try {
      const result = await handler(data); // the handler is what actually DOES something with the msg
      switch (result) {
        case AckType.Ack:
          ch.ack(msg);
          break;
        case AckType.NackRequeue:
          ch.nack(msg, false, true);
          break;
        case AckType.NackDiscard:
          ch.nack(msg, false, false);
          break;
        default:
          const unreachable: never = result;
          console.error("Unexpected ack type:", unreachable);
      }
    } catch (err) {
      console.error("Error in handler:", err);
      ch.nack(msg, false, false);
    }
  },
  { noAck: false }
  );
};

export async function subscribeJSON<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer) => JSON.parse(data.toString())
  )
};

export async function subscribeMsgPack<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer) => decode(data) as T // 'as T' because decode returns unknown by default
  )
}
