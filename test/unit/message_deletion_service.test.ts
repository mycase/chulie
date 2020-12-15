import { expect } from 'chai';
import { assert, createSandbox } from 'sinon';
import AwsMock from 'aws-sdk-mock';

import { MessageDeletionService } from '../../lib/message_deletion_service';
import logger from '../../lib/logger';
import * as Helper from '../../lib/helper';

const sandbox = createSandbox();

describe('MessageDeletionService', function () {
  const message = {
    MessageId: '1',
    Attributes: {
      ApproximateReceiveCount: '10',
    },
    ReceiptHandle: 'handle',
  };

  beforeEach(function () {
    this.queueUrl = 'useful.queue.url';
    this.service = new MessageDeletionService(this.queueUrl);
    this.errorLogSpy = sandbox.spy(logger, 'error');
  });

  afterEach(function () {
    sandbox.restore();
    AwsMock.restore();
  });

  it('should delete the message from queue', async function () {
    const deleteMessageSpy = sandbox.spy((params: any, callback: any) => callback());
    AwsMock.mock('SQS', 'deleteMessage', deleteMessageSpy);

    await this.service.delete(message);
    assert.calledOnce(deleteMessageSpy);
    assert.calledWith(deleteMessageSpy, {
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });
  });

  describe('when a message is already removed from queue', function () {
    it('should not retry', async function () {
      const deleteMessageSpy = sandbox.spy(function (params: any, callback: any) {
        callback({ code: 'ReceiptHandleIsInvalid' });
      });
      AwsMock.mock('SQS', 'deleteMessage', deleteMessageSpy);

      expect(await this.service.delete(message));
      assert.calledOnce(deleteMessageSpy);
      assert.calledWith(
        this.errorLogSpy,
        `[${message.MessageId}] Message is already removed from the queue.`,
      );
    });
  });

  describe('when failed to delete a message', function () {
    it('should retry until succeeded', async function () {
      const errStub = new Error('something is wrong');
      let callCount = 0;
      const deleteMessageSpy = sandbox.spy((params: any, callback: any) => {
        callCount += 1;
        callback(callCount < 5 ? errStub : null);
      });
      AwsMock.mock('SQS', 'deleteMessage', deleteMessageSpy);

      sandbox.stub(Helper, 'delay').resolves();

      await this.service.delete(message);
      assert.callCount(deleteMessageSpy, 5);
    });
  });
});
