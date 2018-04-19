import { expect } from 'chai';
import { SQS } from 'aws-sdk';
import MessageParser from '../../lib/message_parser';
import { JsonObject } from '../../lib/json_object';

const msgBody: JsonObject = {
  name: 'someone',
  desc: 'something',
  list: ['1', '2'],
};

const sqsMessage: SQS.Message = {
  MessageId: 'good-id-1',
  MessageAttributes: {
    job_class: {
      DataType: 'String',
      StringValue: 'TestWorker1',
    },
    string_attr: {
      DataType: 'String',
      StringValue: 'some value',
    },
    number_attr: {
      DataType: 'Number',
      StringValue: '42',
    },
    binary_attr: {
      DataType: 'Binary',
      BinaryValue: '12345',
    },
    custom_attr: {
      DataType: 'Other',
      BinaryValue: '12345',
    },
  },
  Body: JSON.stringify(msgBody),
};

describe('Parsed message', function () {
  beforeEach(function () {
    this.msg = new MessageParser().parse(sqsMessage);
  });

  it('should have a copy of original message', function () {
    expect(this.msg.originalMessage).to.eql(sqsMessage);
  });

  it('should have original message ID', function () {
    expect(this.msg.id).to.equal(sqsMessage.MessageId);
  });

  describe('attributes', function () {
    it('should include all number and string attributes from original message', function () {
      expect(this.msg.attributes).to.include({
        job_class: 'TestWorker1',
        string_attr: 'some value',
        number_attr: '42',
      });
    });

    it('should not include binary attributes from original message', function () {
      expect(this.msg.attributes).not.to.have.property('binary_attr');
      expect(this.msg.attributes).not.to.have.property('custom_attr');
    });
  });

  describe('jobClass', function () {
    it('should be read from message attributes', function () {
      const msg = new MessageParser({ jobClassAttributeName: 'job_class' }).parse(sqsMessage);
      expect(msg.jobClass).to.equal('TestWorker1');
    });

    it('should be default if jobClassAttributeName is not configured', function () {
      expect(this.msg.jobClass).to.equal('default');
    });

    it('should be default if job class attribute is not present in message attribute', function () {
      const msg = new MessageParser({ jobClassAttributeName: 'wrong_class' }).parse(sqsMessage);
      expect(msg.jobClass).to.equal('default');
    });
  });

  describe('body', function () {
    it('should be original message body string if bodyFormat is configured as string', function () {
      const msg = new MessageParser({ bodyFormat: 'string' }).parse(sqsMessage);
      expect(msg.body).to.equal(JSON.stringify(msgBody));
    });

    it('should be original message body string if bodyFormat is not configured', function () {
      expect(this.msg.body).to.equal(JSON.stringify(msgBody));
    });

    it('should be parsed to a JSON object if bodyFormat is configured as json', function () {
      const msg = new MessageParser({ bodyFormat: 'json' }).parse(sqsMessage);
      expect(msg.body).to.eql(msgBody);
    });
  });
});
