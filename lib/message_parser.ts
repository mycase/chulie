import { SQS } from 'aws-sdk';
import { MessageConfig } from './config';
import { Message, MessageAttributes, MessageBody } from './message';

function parseAttributes(msg: SQS.Message): MessageAttributes {
  if (msg.MessageAttributes) {
    return Object.assign(
      {},
      ...Object.entries(msg.MessageAttributes)
               .filter(([name, val]) => val.DataType === 'String' || val.DataType === 'Number')
               .map(([name, val]) => ({ [name]: val.StringValue })),
    );
  }
  return {};
}

function parseBody(msg: SQS.Message, fmt?: string): MessageBody {
  if (fmt === 'json') return JSON.parse(msg.Body || '{}');
  return msg.Body || '';
}

export default class MessageParser {
  private config: MessageConfig;

  constructor(config: MessageConfig = {}) {
    this.config = config;
  }

  parse(msg: SQS.Message): Message {
    const attributes = parseAttributes(msg);
    const body = parseBody(msg, this.config.bodyFormat);
    return {
      originalMessage: msg,
      id: msg.MessageId || 'Unknown_Message_ID',
      attributes,
      jobClass: this.config.jobClassAttributeName ?
        attributes[this.config.jobClassAttributeName] || 'default' : 'default',
      body,
    };
  }
}
