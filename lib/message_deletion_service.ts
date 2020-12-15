import { SQS } from 'aws-sdk';
import logger from './logger';
import { delay, fibonacciBackoffDelay } from './helper';

export class MessageDeletionService {
  queueUrl: string;

  constructor(queueUrl: string) {
    this.queueUrl = queueUrl;
  }

  async delete(message: SQS.Message) {
    logger.debug(`MessageDeletionService.delete: SQS message: ${JSON.stringify(message)}`);
    if (!message.ReceiptHandle) return;
    const sqs = new SQS();

    let errorCount = 0;
    while (true) {
      try {
        await sqs.deleteMessage({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }).promise();
        return;
      } catch (err) {
        if (err.code === 'ReceiptHandleIsInvalid') {
          logger.error(`[${message.MessageId}] Message is already removed from the queue.`);
          return;
        }
        const waitTime = fibonacciBackoffDelay(errorCount);
        logger.error(`[${message.MessageId}] Failed to delete message.`, err);
        logger.error(`[${message.MessageId}] Waiting for ${waitTime} seconds before retry.`);
        errorCount++;
        await delay(waitTime * 1000);
      }
    }
  }
}
