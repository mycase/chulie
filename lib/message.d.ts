import { SQS } from 'aws-sdk';
import { JsonObject } from './json_object';

export interface MessageAttributes {
  [name: string]: string;
}

export type MessageBody = string | JsonObject;

export interface Message {
  originalMessage: SQS.Message;
  id: string;
  attributes: MessageAttributes;
  jobClass: string;
  body: MessageBody;
}
