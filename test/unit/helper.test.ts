import { expect } from 'chai';
import { assert, createSandbox, match } from 'sinon';

import { fibonacciBackoffDelay, delay } from '../../lib/helper';

const sandbox = createSandbox();

describe('Helper functions', function () {
  afterEach(function () {
    sandbox.restore();
  });

  describe('fibonacciBackoffDelay', function () {
    describe('without maxDelay', function () {
      it('should return the Fibonacci number', function() {
        expect(fibonacciBackoffDelay(0)).to.equal(0);
        expect(fibonacciBackoffDelay(1)).to.equal(1);
        expect(fibonacciBackoffDelay(2)).to.equal(1);
        expect(fibonacciBackoffDelay(3)).to.equal(2);
        expect(fibonacciBackoffDelay(4)).to.equal(3);
        expect(fibonacciBackoffDelay(5)).to.equal(5);
        expect(fibonacciBackoffDelay(6)).to.equal(8);
      });
    });

    describe('with maxDelay', function () {
      it('should return the Fibonacci number if it is less than the maxDelay', function() {
        expect(fibonacciBackoffDelay(0, 6)).to.equal(0);
        expect(fibonacciBackoffDelay(1, 6)).to.equal(1);
        expect(fibonacciBackoffDelay(2, 6)).to.equal(1);
        expect(fibonacciBackoffDelay(3, 6)).to.equal(2);
        expect(fibonacciBackoffDelay(4, 6)).to.equal(3);
        expect(fibonacciBackoffDelay(5, 6)).to.equal(5);
      });

      it('should return maxDely if the Fibonacci number is more  than the maxDelay', function() {
        expect(fibonacciBackoffDelay(6, 6)).to.equal(6);
        expect(fibonacciBackoffDelay(7, 6)).to.equal(6);
        expect(fibonacciBackoffDelay(8, 6)).to.equal(6);
      });
    });
  });

  describe('delay', function () {
    it('should resolve after proper delay', function (done) {
      const setTimeoutStub = sandbox.stub(global, 'setTimeout').yields();
      delay(1000).then(() => done());
      assert.calledOnce(setTimeoutStub);
      assert.calledWith(setTimeoutStub, match.any, 1000);
    });
  });
});
