import { assert, createSandbox } from 'sinon';
import AwsMock from 'aws-sdk-mock';

import RetryingService from '../../lib/retrying_service';
import logger from '../../lib/logger';
import { fibonacciBackoffDelay } from '../../lib/helper';

const sandbox = createSandbox();

describe('RetryingService', function () {
  const message = {
    MessageId: '1',
    Attributes: {
      ApproximateReceiveCount: '10',
    },
    ReceiptHandle: 'handle',
  };

  beforeEach(function () {
    this.queueUrl = 'useful.queue.url';
    this.service = new RetryingService(this.queueUrl);
    this.errorLogSpy = sandbox.spy(logger, 'error');
  });

  afterEach(function () {
    sandbox.restore();
    AwsMock.restore();
  });

  it('should setup backoff retry based on message receive count', async function () {
    const changeMessageVisibilitySpy = sandbox.spy(function (params, callback) { callback(); });
    AwsMock.mock('SQS', 'changeMessageVisibility', changeMessageVisibilitySpy);
    const expectedDelay = fibonacciBackoffDelay(
      parseInt(message.Attributes.ApproximateReceiveCount, 10) - 1,
    );

    await this.service.retry(message);
    assert.calledOnce(changeMessageVisibilitySpy);
    assert.calledWith(changeMessageVisibilitySpy, {
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
      VisibilityTimeout: expectedDelay,
    });
    assert.calledWith(
      this.errorLogSpy,
      `[${message.MessageId}] Delaying ${expectedDelay} seconds to retry.`,
    );
  });

  it('should log error when message is already removed from the queue', async function () {
    AwsMock.mock('SQS', 'changeMessageVisibility', function (params, callback) {
      callback({ code: 'ReceiptHandleIsInvalid' });
    });

    await this.service.retry(message);
    assert.calledWith(
      this.errorLogSpy,
      `[${message.MessageId}] Message was already removed from the queue.`,
    );
  });

  it('should log error on all other errors', async function () {
    const errStub = sandbox.stub();
    AwsMock.mock('SQS', 'changeMessageVisibility', function (params, callback) {
      callback(errStub);
    });

    await this.service.retry(message);
    assert.calledWith(
      this.errorLogSpy,
      `[${message.MessageId}] Failed to update message visibility timeout, ` +
        'message will be retried after current visibility timeout.',
      errStub,
    );
  });
});
