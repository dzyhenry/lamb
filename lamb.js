/* eslint no-continue: 0, no-use-before-define: 0 */

const VALIDATE_STATE = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2,
};

const Utils = {
  runAsync: (fn) => {
    setTimeout(fn, 0);
  },
  isPromise: p => p && p instanceof Lamb,
  isObject: value => value && typeof value === 'object',
  isFunction: value => value && typeof value === 'function',
  defaultFulfillCallback: value => value,
  defaultRejectCallback: (reason) => { throw reason; },
  isValidateState: state => (state === VALIDATE_STATE.PENDING) || (state === VALIDATE_STATE.FULFILLED) ||
    (state || VALIDATE_STATE.REJECTED),
};

const resolve = (promise, x) => {
  if (x === promise) {
    promise.transition(VALIDATE_STATE.REJECTED, new TypeError('The promise and its value refer to the same object.'));
  } else if (Utils.isPromise(x)) {
    if (x.state === VALIDATE_STATE.PENDING) {
      x.then(value => resolve(promise, value), reason => promise.transition(VALIDATE_STATE.REJECTED, reason));
    } else {
      promise.transition(x.state, x.value);
    }
  } else if (Utils.isObject(x) || Utils.isFunction(x)) {
    let then = null;
    let isCalled = false;
    try {
      then = x.then;
      if (Utils.isFunction(then)) {
        then.call(x, (value) => {
          if (!isCalled) {
            resolve(promise, value);
            isCalled = true;
          }
        }, (reason) => {
          if (!isCalled) {
            promise.reject(reason);
            isCalled = true;
          }
        });
      } else {
        promise.fulfill(x);
        isCalled = true;
      }
    } catch (e) {
      if (!isCalled) {
        promise.reject(e);
        isCalled = true;
      }
    }
  } else {
    promise.fulfill(x);
  }
};

class Lamb {
  constructor(fn) {
    this.queue = [];
    this.state = VALIDATE_STATE.PENDING;
    this.handlers = {
      onFulfilled: null,
      onRejected: null,
    };
    const that = this;
    if (fn) {
      fn((value) => {
        resolve(that, value);
      }, (reason) => {
        that.reject(reason);
      });
    }
  }

  then(onFulfilled, onRejected) {
    const queuedPromise = new Lamb();
    if (Utils.isFunction(onFulfilled)) {
      queuedPromise.handlers.onFulfilled = onFulfilled;
    }
    if (Utils.isFunction(onRejected)) {
      queuedPromise.handlers.onRejected = onRejected;
    }
    this.queue.push(queuedPromise);
    this.process();
    return queuedPromise;
  }

  process() {
    if (this.state === VALIDATE_STATE.PENDING) {
      return;
    }
    const that = this;

    // 2.2.4 onFulfilled or onRejected must not be called until the execution context stack contains only platform code.
    Utils.runAsync(() => {
      while (that.queue && that.queue.length) {
        const queuedPromise = that.queue.shift();
        let handler = null;
        let value = null;
        if (that.state === VALIDATE_STATE.FULFILLED) {
          handler = queuedPromise.handlers.onFulfilled || Utils.defaultFulfillCallback;
        } else if (that.state === VALIDATE_STATE.REJECTED) {
          handler = queuedPromise.handlers.onRejected || Utils.defaultRejectCallback;
        }

        try {
          value = handler(that.value);
        } catch (e) {
          queuedPromise.transition(VALIDATE_STATE.REJECTED, e);
          continue;
        }
        resolve(queuedPromise, value);
      }
    });
  }

  transition(state, value) {
    if (this.state === state || this.state !== VALIDATE_STATE.PENDING || !Utils.isValidateState(state) ||
      arguments.length !== 2) {
      return;
    }
    this.state = state;
    this.value = value;
    this.process();
  }

  reject(reason) {
    this.transition(VALIDATE_STATE.REJECTED, reason);
  }

  fulfill(value) {
    this.transition(VALIDATE_STATE.FULFILLED, value);
  }
}

module.exports = {
  resolved: value => new Lamb(onFulfilled => onFulfilled(value)),
  rejected: reason => new Lamb((onFulfilled, onRejected) => { onRejected(reason); }),
  deferred: () => {
    let resov = null;
    let reject = null;
    return {
      promise: new Lamb((onFulfilled, onRejected) => {
        resov = onFulfilled;
        reject = onRejected;
      }),
      resolve: resov,
      reject,
    };
  },
  Lamb,
};
