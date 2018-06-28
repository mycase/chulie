import { SQS, config as awsConfig } from 'aws-sdk';

import { Config, QueueConfig, QueueDriveMode } from './config';
import logger from './logger';
import { Message } from './message';
import { MessageParser } from './message_parser';
import { MessageDeletionService } from './message_deletion_service';
import { RetryingService } from './retrying_service';
import { fibonacciBackoffDelay, delay } from './helper';

const SQS_RECEIVE_MESSAGE_BATCH_LIMIT = 10;

const STATUS_OK = 0;
const STATUS_NO_MESSAGE = -1;

export type JobHandler = (message: Message) => Promise<void>;

interface JobRegistry {
  [jobClass: string] : JobHandler;
}

export class SqsProcessor {
  private jobRegistry: JobRegistry = {};
  private queueUrl: string;
  private longPollingWait: number;
  private maxFetchDelay: number;
  private driveMode: QueueDriveMode;
  private maxFetchingRetry: number;

  private messageParser: MessageParser;
  private messageDeletionService: MessageDeletionService;
  private retryingService: RetryingService;

  constructor(config: Config) {
    this.queueUrl = config.queue.url;
    this.longPollingWait = config.queue.longPollingTimeSeconds || 5;
    this.maxFetchDelay = config.queue.maxFetchingDelaySeconds || 60;
    this.driveMode = config.queue.driveMode || 'deplete';
    this.maxFetchingRetry = config.queue.maxFetchingRetry || 0;

    if (config.aws) awsConfig.update(config.aws);
    logger.setLevel(config.logLevel || 'info');

    this.messageParser = new MessageParser(config.message);
    this.messageDeletionService = new MessageDeletionService(this.queueUrl);
    this.retryingService = new RetryingService(this.queueUrl);
  }

  on(jobClass: string, handler: JobHandler){
    this.jobRegistry[jobClass] = handler;
  }

  async start() {
    if (this.driveMode === 'single') {
      await this.fetchAndProcess();
    } else {
      let fetchErrCount = 0;
      let cont = true;
      while (cont) {
        const fetchStatus = await this.fetchAndProcess(fetchErrCount);
        if (this.driveMode === 'deplete' &&
          (fetchStatus === STATUS_NO_MESSAGE || fetchStatus > this.maxFetchingRetry)) {
          cont = false;
        }
        if (fetchStatus >= STATUS_OK) fetchErrCount = fetchStatus;
      }
    }
  }

  // return values:
  //  STATUS_OK(0):  fetched successfully and received/processed messages
  //  STATUS_NO_MESSAGE(-1): fetched successfully and no message received
  //  >0: fetch error count
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
      return STATUS_OK;
    }
    logger.info(`No job received, queue is empty.`);
    return STATUS_NO_MESSAGE;
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
    logger.debug('SqsProcessor.fetchMessages: Calling SQS.receiveMessage with '
      + JSON.stringify(params));
    const data = await sqs.receiveMessage(params).promise();
    logger.debug(`SqsProcessor.fetchMessages: Response: ${JSON.stringify(data)}`);
    if (data && data.Messages) {
      return data.Messages;
    }
    return [];
  }

  private processMessages(msgs: SQS.Message[]) {
    return Promise.all(msgs.map(msg => this.processMessage(msg)));
  }

  private async processMessage(msg: SQS.Message) {
    logger.debug(`SqsProcessor.processMessage: Original SQS message: ${JSON.stringify(msg)}`);
    let message: Message;
    try {
      message = this.messageParser.parse(msg);
    } catch (err) {
      logger.error(`[${msg.MessageId}] Failed to parse message.`, err);
      return this.retryingService.retry(msg);
    }

    logger.debug(`SqsProcessor.processMessage: Parsed message: ${JSON.stringify(msg)}`);
    const handler = this.jobRegistry[message.jobClass];
    if (handler) {
      logger.info(`[${message.id}] Starting.`);
      try {
        await handler(message);
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
