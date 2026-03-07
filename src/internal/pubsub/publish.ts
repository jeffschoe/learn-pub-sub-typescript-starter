import { encode } from "@msgpack/msgpack";
import type { ConfirmChannel } from "amqplib";


export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const valueJsonString = JSON.stringify(value); //cvt to json string
  const content = Buffer.from(valueJsonString); //cvt to json bytes (buffer)

  return new Promise((resolve, reject) => {
    ch.publish(
      exchange, 
      routingKey, 
      content, 
      {contentType: "application/json"}, 
      (err) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        } else {
          resolve();
        }
      }
    );
  });

};

function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const body = encode(value); //cvt to json string
  
  return new Promise((resolve, reject) => {
    ch.publish(
      exchange, 
      routingKey, 
      Buffer.from(body), 
      {contentType: "application/x-msgpack"}, 
      (err) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        } else {
          resolve();
        }
      }
    );
  });
}