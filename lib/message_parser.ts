import { SQS } from 'aws-sdk';
import { MessageConfig } from './config';
import { Message, MessageAttributes, MessageBody, MessageBodyFormat } from './message';

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

function parseBody(msg: SQS.Message, fmt: MessageBodyFormat): MessageBody {
  if (fmt === 'json') return JSON.parse(msg.Body || '{}');
  return msg.Body || '';
}

export class MessageParser {
  private bodyFormat: MessageBodyFormat;
  private jobClassAttribute?: string;

  constructor(config: MessageConfig = {}) {
    this.bodyFormat = config.bodyFormat || 'string';
    this.jobClassAttribute = config.jobClassAttributeName;
  }

  parse(msg: SQS.Message): Message {
    const attributes = parseAttributes(msg);
    const body = parseBody(msg, this.bodyFormat);
    return {
      originalMessage: msg,
      id: msg.MessageId || 'Unknown_Message_ID',
      attributes,
      jobClass: this.jobClassAttribute ?
        attributes[this.jobClassAttribute] || 'default' : 'default',
      body,
    };
  }
}
