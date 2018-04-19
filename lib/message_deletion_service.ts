import { SQS } from 'aws-sdk';
import logger from './logger';
import { fibonacciBackoffDelay } from './helper';

export default class MessageDeletionService {
  queueUrl: string;

  constructor(queueUrl: string) {
    this.queueUrl = queueUrl;
  }

  async delete(message: SQS.Message, errorCount: number = 0) {
    if (!message.ReceiptHandle) return;
    const sqs = new SQS();
    try {
      await sqs.deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }).promise();
    } catch (err) {
      if (err.code === 'ReceiptHandleIsInvalid') {
        logger.error(`[${message.MessageId}] Message is already removed from the queue.`);
        return;
      }
      const waitTime = fibonacciBackoffDelay(errorCount);
      logger.error(`[${message.MessageId}] Failed to delete message.`, err);
      logger.error(`[${message.MessageId}] Waiting for ${waitTime} seconds before retry.`);
      errorCount++;
      setTimeout(
        () => this.delete(message, errorCount),
        waitTime * 1000,
      );
    }
  }
}
