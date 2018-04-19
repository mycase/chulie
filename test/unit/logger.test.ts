import { expect } from 'chai';
import { assert, createSandbox, match } from 'sinon';
import logger from '../../lib/logger';

const sandbox = createSandbox();

describe('logger', function () {
  beforeEach(function () {
    this.oldLevel = logger.getLevel();
    logger.setLevel(0);
  });

  afterEach(function () {
    sandbox.restore();
    logger.setLevel(this.oldLevel);
  });

  ['debug', 'info'].forEach((method) => {
    describe(method, function () {
      it(`should write message to stdout`, function () {
        const stdOutStub = sandbox.stub(process.stdout, 'write');
        logger[method]('words');
        assert.calledOnce(stdOutStub);
        assert.calledWith(stdOutStub, match('words'));
        sandbox.restore();
      });
    });
  });

  describe('warn', function () {
    it('should write message to stderr', function () {
      const stdErrStub = sandbox.stub(process.stderr, 'write');
      logger.error('something may be wrong');
      assert.calledOnce(stdErrStub);
      assert.calledWith(stdErrStub, match('something may be wrong'));
    });
  });

  describe('error', function () {
    beforeEach(function () {
      this.stdErrStub = sandbox.stub(process.stderr, 'write');
    });

    it('should write message to stderr if no error provided', function () {
      logger.error('something is wrong');
      assert.calledOnce(this.stdErrStub);
      assert.calledWith(this.stdErrStub, match('something is wrong'));
    });

    it('should format error if error is provided', function () {
      try {
        throw new Error('wrong wrong');
      } catch(err) {
        logger.error('something is wrong', err);
        assert.calledOnce(this.stdErrStub);
        assert.calledWith(this.stdErrStub,
          match(`something is wrong Error: ${err}\n  ${err.stack}`));
      }
    });
  });
});
