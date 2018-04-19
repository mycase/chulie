import { expect } from 'chai';
import { assert, createSandbox } from 'sinon';
import AwsMock from 'aws-sdk-mock';

import MessageDeletionService from '../../lib/message_deletion_service';
import logger from '../../lib/logger';
import { fibonacciBackoffDelay } from '../../lib/helper';

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
    const deleteMessageSpy = sandbox.spy((params, callback) => callback());
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
      const deleteMessageSpy = sandbox.spy(function (params, callback) {
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
    beforeEach(function () {
      this.errStub = new Error('wrong wrong');
      this.deleteMessageSpy = sandbox.spy((params, callback) => {
        callback(this.errStub);
      });
      AwsMock.mock('SQS', 'deleteMessage', this.deleteMessageSpy);

      this.clock = sandbox.useFakeTimers();
    });

    afterEach(function () {
      this.clock.restore();
    });

    it('should log error', async function () {
      expect(await this.service.delete(message));
      assert.calledWith(
        this.errorLogSpy,
        `[${message.MessageId}] Failed to delete message.`,
        this.errStub,
      );
      assert.calledWith(
        this.errorLogSpy,
        `[${message.MessageId}] Waiting for 0 seconds before retry.`,
      );
    });

    it('should retry indefinitely', function (done) {
      this.service.delete(message).then(() => {
        assert.calledOnce(this.deleteMessageSpy);
        assert.calledWith(this.errorLogSpy, '[1] Failed to delete message.', this.errStub);
        assert.calledWith(this.errorLogSpy, '[1] Waiting for 0 seconds before retry.');
        this.clock.tick(0);
        process.nextTick(() => {
          assert.calledTwice(this.deleteMessageSpy);
          assert.calledWith(this.errorLogSpy, '[1] Waiting for 1 seconds before retry.');
          this.clock.tick(1000);
          process.nextTick(() => {
            assert.calledThrice(this.deleteMessageSpy);
            assert.calledWith(this.errorLogSpy, '[1] Waiting for 1 seconds before retry.');
            this.clock.tick(1000);
            process.nextTick(() => {
              assert.callCount(this.deleteMessageSpy, 4);
              assert.calledWith(this.errorLogSpy, '[1] Waiting for 2 seconds before retry.');
              this.clock.tick(2000);
              process.nextTick(() => {
                assert.callCount(this.deleteMessageSpy, 5);
                assert.calledWith(this.errorLogSpy,
                  '[1] Waiting for 3 seconds before retry.');
                this.clock.tick(3000);
                process.nextTick(() => {
                  assert.callCount(this.deleteMessageSpy, 6);
                  assert.calledWith(this.errorLogSpy,
                    '[1] Waiting for 5 seconds before retry.');
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});
