import { expect } from 'chai';
import { assert, createSandbox } from 'sinon';
import * as AwsMock from 'aws-sdk-mock';

import { SqsProcessor } from '../../lib/sqs_processor';
import { Message } from '../../lib/message';
import { Config } from '../../lib/config';
import * as Helper from '../../lib/helper';
import logger from '../../lib/logger';

const sandbox = createSandbox();

const config: Config = {
  logLevel: 'silent',
  queue: {
    url: 'https://good.queue.url',
    longPollingTimeSeconds: 5,
    maxFetchingDelaySeconds: 6,
  },
  message: {
    jobClassAttributeName: 'job_class',
    bodyFormat: 'json',
  },
};

const receiveMessageParams = {
  QueueUrl: `${config.queue.url}`,
  AttributeNames: ['ApproximateReceiveCount'],
  MessageAttributeNames: ['All'],
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: config.queue.longPollingTimeSeconds,
};

describe('SqsProcessor', function () {
  beforeEach(function () {
    this.logSpy = sandbox.spy(logger, 'info');
    this.errorLogSpy = sandbox.spy(logger, 'error');
    this.processor = new SqsProcessor(config);
    this.defaultHandlerStub = sandbox.stub();
    this.handler1Stub = sandbox.stub();
    this.handler2Stub = sandbox.stub();
    this.processor.on('default', this.defaultHandlerStub);
    this.processor.on('TestWorker1', this.handler1Stub);
    this.processor.on('TestWorker2', this.handler2Stub);
  });

  afterEach(function () {
    AwsMock.restore();
    sandbox.restore();
  });

  describe('when failed to receive message', function () {
    beforeEach(function(){
      this.errStub = new Error('bad queue');
      this.receiveMessageSpy = sandbox.spy((params, callback) => callback(this.errStub));
      AwsMock.mock('SQS', 'receiveMessage', this.receiveMessageSpy);
      this.delayStub = sandbox.stub(Helper, 'delay').resolves();
    });

    it('should log error', async function () {
      await this.processor.start(1);
      assert.calledWith(this.logSpy, 'Fetching messages from queue.');
      assert.calledWith(this.receiveMessageSpy, receiveMessageParams);
      assert.calledWith(
        this.errorLogSpy.firstCall,
        'Failed to receive messages from queue.',
        this.errStub,
      );
      assert.calledWith(
        this.errorLogSpy.secondCall,
        'Waiting for 0 seconds before retry.',
      );
      assert.calledWith(this.delayStub, Helper.fibonacciBackoffDelay(0) * 1000);
    });

    it('should retry with incremental delay', async function () {
      await this.processor.start(10);
      [...Array(10).keys()].map((count) => {
        const delay = Helper.fibonacciBackoffDelay(
          count, config.queue.maxFetchingDelaySeconds);
        assert.calledWith(
          this.errorLogSpy,
          `Waiting for ${delay} seconds before retry.`,
        );
        assert.calledWith(this.delayStub.getCall(count), delay * 1000);
      });
    });
  });

  describe('when the queue is empty', function () {
    beforeEach(function() {
      this.receiveMessageSpy = sandbox.spy((params, callback) => callback(null, { Messages: [] }));
      AwsMock.mock('SQS', 'receiveMessage', this.receiveMessageSpy);
      this.delaySpy = sandbox.spy(Helper, 'delay');
    });

    it('should not call any message handlers', async function () {
      await this.processor.start(1);
      assert.calledWith(this.logSpy, 'Fetching messages from queue.');
      assert.calledWith(this.receiveMessageSpy, receiveMessageParams);
      assert.notCalled(this.defaultHandlerStub);
      assert.notCalled(this.handler1Stub);
      assert.notCalled(this.handler2Stub);
      assert.calledWith(this.logSpy, 'No job received, queue is empty.');
    });

    it('should try to fetch jobs again immediately', async function () {
      await this.processor.start(2);
      assert.calledTwice(this.receiveMessageSpy);
      assert.notCalled(this.delaySpy);
    });
  });

  describe('when the queue has messages', function () {
    beforeEach(function () {
      this.messages = [
        {
          MessageId: '0',
          Attributes: {
            ApproximateReceiveCount: '1',
          },
          MessageAttributes: {
          },
          Body: JSON.stringify({ desc: 'job for default worker' }),
          ReceiptHandle: 'handle0',
        },
        {
          MessageId: '1',
          Attributes: {
            ApproximateReceiveCount: '10',
          },
          MessageAttributes: {
            job_class: {
              DataType: 'String',
              StringValue: 'TestWorker1',
            },
          },
          Body: JSON.stringify({ desc: 'job for worker 1' }),
          ReceiptHandle: 'handle1',
        },
        {
          MessageId: '2',
          Attributes: {
            ApproximateReceiveCount: '1',
          },
          MessageAttributes: {
            job_class: {
              DataType: 'String',
              StringValue: 'TestWorker2',
            },
          },
          Body: JSON.stringify({ desc: 'job for worker 2' }),
          ReceiptHandle: 'handle2',
        },
      ];

      this.deleteMessageStub = sandbox.stub(this.processor.messageDeletionService, 'delete');
      this.retryStub = sandbox.stub(this.processor.retryingService, 'retry');
    });

    describe('and everything is successful', function () {
      beforeEach(function () {
        AwsMock.mock('SQS', 'receiveMessage', (params, callback) => {
          callback(null, { Messages: this.messages });
        });
      });

      it('should process all messages', async function () {
        await this.processor.start(1);
        assert.calledOnce(this.defaultHandlerStub);
        assert.calledOnce(this.handler1Stub);
        assert.calledOnce(this.handler2Stub);
        assert.calledWith(this.deleteMessageStub, this.messages[0]);
        assert.calledWith(this.deleteMessageStub, this.messages[1]);
        assert.calledWith(this.deleteMessageStub, this.messages[2]);

        assert.calledWith(this.logSpy, 'Fetching messages from queue.');
        assert.calledWith(this.logSpy, 'Received 3 messages, processing.');
        assert.calledWith(this.logSpy, '[0] Starting.');
        assert.calledWith(this.logSpy, '[0] Deleting message from queue.');
        assert.calledWith(this.logSpy, '[0] Finished.');
        assert.calledWith(this.logSpy, '[1] Starting.');
        assert.calledWith(this.logSpy, '[1] Deleting message from queue.');
        assert.calledWith(this.logSpy, '[1] Finished.');
        assert.calledWith(this.logSpy, '[2] Starting.');
        assert.calledWith(this.logSpy, '[2] Deleting message from queue.');
        assert.calledWith(this.logSpy, '[2] Finished.');
      });
    });

    describe('and failed to parse a message', function () {
      beforeEach(function () {
        AwsMock.mock('SQS', 'receiveMessage', (params, callback) => {
          callback(null, { Messages: this.messages.slice(0,1) });
        });

        this.errStub = new Error('too bad');
        sandbox.stub(this.processor.messageParser, 'parse').throws(this.errStub);
      });

      it('should log error', async function () {
        await this.processor.start(1);
        assert.calledWith(this.errorLogSpy,
          `[${this.messages[0].MessageId}] Failed to parse message.`,
          this.errStub,
        );
      });

      it('should retry message', async function () {
        await this.processor.start(1);
        assert.calledWith(this.retryStub, this.messages[0]);
      });

      it('should not delete message', async function () {
        await this.processor.start(1);
        assert.notCalled(this.deleteMessageStub);
      });
    });

    describe('and message has a unregistered job class', function () {
      beforeEach(function () {
        this.message = {
          MessageId: '11',
          Attributes: {
            ApproximateReceiveCount: '10',
          },
          MessageAttributes: {
            job_class: {
              DataType: 'String',
              StringValue: 'UnregisteredWorker',
            },
          },
          Body: JSON.stringify({ desc: 'unknown job' }),
          ReceiptHandle: 'handle11',
        };

        AwsMock.mock('SQS', 'receiveMessage', (params, callback) => {
          callback(null, { Messages: [this.message] });
        });
      });

      it('should log an error', async function () {
        await this.processor.start(1);
        assert.calledWith(this.errorLogSpy,
          '[11] No job handler registered for UnregisteredWorker messages.');
      });

      it('should not throw', async function () {
        try {
          await this.processor.start(1);
        } catch (err) {
          expect('should throw').to.be.false;
        }
      });

      it('should not call any handlers', async function () {
        await this.processor.start(1);
        assert.notCalled(this.defaultHandlerStub);
        assert.notCalled(this.handler1Stub);
        assert.notCalled(this.handler2Stub);
      });

      it('should delete message', async function () {
        await this.processor.start(1);
        assert.calledWith(this.deleteMessageStub, this.message);
      });
    });

    describe('and failed to run the handler', function () {
      beforeEach(function () {
        AwsMock.mock('SQS', 'receiveMessage', (params, callback) => {
          callback(null, { Messages: this.messages.slice(0,1) });
        });
        this.errStub = new Error('too bad');
        this.defaultHandlerStub.throws(this.errStub);
      });

      it('should log an error', async function () {
        await this.processor.start(1);
        assert.calledWith(this.errorLogSpy,
          `[${this.messages[0].MessageId}] Failed to process message.`,
          this.errStub,
        );
      });

      it('should retry message', async function () {
        await this.processor.start(1);
        assert.calledWith(this.retryStub, this.messages[0]);
      });

      it('should not delete message', async function () {
        await this.processor.start(1);
        assert.notCalled(this.deleteMessageStub);
      });
    });
  });
});
