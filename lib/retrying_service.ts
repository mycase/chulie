import { SQS } from 'aws-sdk';
import logger from './logger';
import { fibonacciBackoffDelay } from './helper';

export class RetryingService {
  private queueUrl: string;

  constructor(queueUrl: string){
    this.queueUrl = queueUrl;
  }

  async retry(msg: SQS.Message) {
    logger.debug(`RetryingService.retry: SQS message: ${JSON.stringify(msg)}`);
    /* istanbul ignore if */
    if (!msg.ReceiptHandle) return;
    const sqs = new SQS();
    let delayTime = 0;
    /* istanbul ignore else */
    if (msg.Attributes && msg.Attributes.ApproximateReceiveCount){
      const receiveCount = parseInt(msg.Attributes.ApproximateReceiveCount, 10);
      delayTime = fibonacciBackoffDelay(receiveCount - 1);
    }

    logger.error(`[${msg.MessageId}] Delaying ${delayTime} seconds to retry.`);
    try {
      await sqs.changeMessageVisibility({
        QueueUrl: this.queueUrl,
        ReceiptHandle: msg.ReceiptHandle,
        VisibilityTimeout: delayTime,
      }).promise();
    } catch (err) {
      if (err.code === 'ReceiptHandleIsInvalid') {
        logger.error(`[${msg.MessageId}] Message was already removed from the queue.`);
      } else {
        logger.error(`[${msg.MessageId}] Failed to update message visibility timeout, ` +
        'message will be retried after current visibility timeout.', err);
      }
    }
  }
}
