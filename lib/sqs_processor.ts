import { SQS, config as awsConfig } from 'aws-sdk';

import { Config, QueueConfig } from './config';
import logger from './logger';
import { Message } from './message';
import MessageParser from './message_parser';
import MessageDeletionService from './message_deletion_service';
import RetryingService from './retrying_service';
import { fibonacciBackoffDelay, delay } from './helper';

const SQS_RECEIVE_MESSAGE_BATCH_LIMIT = 10;

export type JobHandler = (message: Message) => void;

interface JobRegistry {
  [jobClass: string] : JobHandler;
}

export class SqsProcessor {
  private jobRegistry: JobRegistry = {};
  private queueUrl: string;
  private longPollingWait: number;
  private maxFetchDelay: number;

  private messageParser: MessageParser;
  private messageDeletionService: MessageDeletionService;
  private retryingService: RetryingService;

  constructor(config: Config) {
    this.queueUrl = config.queue.url;
    this.longPollingWait = config.queue.longPollingTimeSeconds || 5;
    this.maxFetchDelay = config.queue.maxFetchingDelaySeconds || 60;

    if (config.aws) awsConfig.update(config.aws);
    logger.setLevel(config.logLevel || 'info');

    this.messageParser = new MessageParser(config.message);
    this.messageDeletionService = new MessageDeletionService(this.queueUrl);
    this.retryingService = new RetryingService(this.queueUrl);
  }

  on(jobClass: string, handler: JobHandler){
    this.jobRegistry[jobClass] = handler;
  }

  async start(maxFetches: number = Infinity) {
    let fetchErrCount = 0;
    for (let i = 0; i < maxFetches; i++) {
      fetchErrCount = await this.fetchAndProcess(fetchErrCount);
    }
  }

  private async fetchAndProcess(fetchErrCount: number = 0) {
    logger.info('Fetching messages from queue.');
    let messages: SQS.Message[];
    try {
      messages = await this.fetchMessages();
    } catch (err) {
      logger.error('Failed to receive messages from queue.', err);
      const waitTime = fibonacciBackoffDelay(fetchErrCount,
        this.maxFetchDelay);
      logger.error(`Waiting for ${waitTime} seconds before retry.`);
      await delay(waitTime * 1000);
      fetchErrCount++;
      return fetchErrCount;
    }
    if (messages && messages.length > 0) {
      logger.info(`Received ${messages.length} messages, processing.`);
      await this.processMessages(messages);
    } else {
      logger.info(`No job received, queue is empty.`);
    }
    return 0;
  }

  private async fetchMessages(): Promise<SQS.Message[]> {
    const sqs = new SQS();
    const params = {
      QueueUrl: this.queueUrl,
      AttributeNames: ['ApproximateReceiveCount'],
      MessageAttributeNames: ['All'],
      MaxNumberOfMessages: SQS_RECEIVE_MESSAGE_BATCH_LIMIT,
      WaitTimeSeconds: this.longPollingWait,
    };
    const data = await sqs.receiveMessage(params).promise();
    if (data && data.Messages) {
      return data.Messages;
    }
    return [];
  }

  private processMessages(msgs: SQS.Message[]) {
    return Promise.all(msgs.map(msg => this.processMessage(msg)));
  }

  private async processMessage(msg: SQS.Message) {
    let message: Message;
    try {
      message = this.messageParser.parse(msg);
    } catch (err) {
      logger.error(`[${msg.MessageId}] Failed to parse message.`, err);
      return this.retryingService.retry(msg);
    }

    const handler = this.jobRegistry[message.jobClass];
    if (handler) {
      logger.info(`[${message.id}] Starting.`);
      try {
        handler(message);
      } catch (err) {
        logger.error(`[${message.id}] Failed to process message.`, err);
        return this.retryingService.retry(msg);
      }
    } else {
      logger.error(`[${message.id}] No job handler registered for ${message.jobClass} messages.`);
    }
    logger.info(`[${message.id}] Deleting message from queue.`);
    await this.messageDeletionService.delete(msg);
    logger.info(`[${message.id}] Finished.`);
  }
}
