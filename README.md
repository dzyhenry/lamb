<a href="https://promisesaplus.com/">
    <img src="https://promisesaplus.com/assets/logo-small.png" alt="Promises/A+ logo"
         title="Promises/A+ 1.0 compliant" align="right" />
</a>

# Lamb
A promise library in ES6 for learning [Promise/A+ Specification](https://promisesaplus.com/).

- 模仿了[Adehun](https://github.com/abdulapopoola/Adehun)的实现
- 通过了[promises-aplus-tests](https://github.com/promises-aplus/promises-tests)所有测试用例

# Run test
```shell
npm install & npm run test
```

# Implementation Details
在实现过程中，参考[Promise/A+](https://promisesaplus.com)规范，我们把Promise抽象成以下模块。

## then

[then](https://promisesaplus.com/#point-19)方法是规范中定义的方法，同时也应该是Promise最重要的标识，主要特点如下：

- then方法接受两个可选参数: onFulfilled, onRejected
- then方法必须返回一个promise

```javascript
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
```
## transition

`transition`方法检查`promise`当前`state`的合法性并更新其`state`和`value`，并将接下来的处理交给`process`方法。

```javascript
  transition(state, value) {
    if (this.state === state || this.state !== VALIDATE_STATE.PENDING || !Utils.isValidateState(state) ||
      arguments.length !== 2) {
      return;
    }
    this.state = state;
    this.value = value;
    this.process();
  }
```
## process
- 我们知道当一个promise（姑且将这个promise叫做`base promise`）的then方法执行时，then方法创建的新的promise(`queuedPromise`)会被push到`base promise`的pending queue中。
- transiton方法执行后，`base promise`的`state`和`value`更新
- then方法执行后，`base promise`的`pending queue` push 新的`queuedPromise`
- process方法会在then方法和transition方法中被调用，处理后续流程。

```javascript
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
```

>Process runs the Promise Resolution procedure on all internally stored promises (i.e. those that were attached to the base promise through the then function) and enforces the following Promise/A+ 

## resolve

`resolve`可能是promise最核心的模块，它处理promise的“解决”(`resolve`)过程。依照[Promise/A+](https://promisesaplus.com/#point-44)规范的定义，`resolve`方法的形式为: `[[Resolve]](promise, x)`。


```javascript
const resolve = (promise, x) => {
  if (x === promise) {
    // 当需要resolve的x是当前promise的时候，直接reject，并抛出TypeError异常
    promise.transition(VALIDATE_STATE.REJECTED, new TypeError('The promise and its value refer to the same object.'));
  } else if (Utils.isPromise(x)) {
    // 当x的类型是promise且非当前promise时，根据x的state进行相应处理
    if (x.state === VALIDATE_STATE.PENDING) {
      // 若x的state为pending时，当前promise的resolve被延迟
      x.then(value => resolve(promise, value), reason => promise.transition(VALIDATE_STATE.REJECTED, reason));
    } else {
      // 若x的state为fulfilled或者rejected，则使用x的state和value应用于当前promise
      promise.transition(x.state, x.value);
    }
  } else if (Utils.isObject(x) || Utils.isFunction(x)) {
    // 若x的类型为Ojbect或者function时(thenable)，检查该对象上是否有then方法
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
```
## Utils && state

- 根据[Promis/A+](https://promisesaplus.com/#point-10)规范Promise有3个状态: `PENDING`, `FULFILLED(settled)`, `REJECTED(settled)`。
- 处于`FULFILLED`和`REJECTED`状态的`promise`，其状态不能再进行转移。

```javascript
  const VALIDATE_STATE = {
    PENDING: 0,
    FULFILLED: 1,
    REJECTED: 2,
  };

  const Utils = {
    // 异步执行帮助函数
    runAsync: (fn) => {
      setTimeout(fn, 0);
    },
    // 判断一个值是否是promise类型
    isPromise: p => p && p instanceof Lamb,
    // 判断一个值是否是对象类型
    isObject: value => value && typeof value === 'object',
    // 判断一个值是否是函数类型
    isFunction: value => value && typeof value === 'function',
    // 默认的`fulfill`函数
    defaultFulfillCallback: value => value,
    // 默认的`reject`函数
    defaultRejectCallback: (reason) => { throw reason; },
    // 判断一个状态是否是合法的promise状态
    isValidateState: state => (state === VALIDATE_STATE.PENDING) || (state === VALIDATE_STATE.FULFILLED) ||
      (state || VALIDATE_STATE.REJECTED),
  };
```

## fulfill && reject

`fulfill`和`reject`分别会将当前`promise`的状态转移到`settled(fulfilled or rejected)`状态，并交由`transition`方法进行后续处理

```javascript
  reject(reason) {
    this.transition(VALIDATE_STATE.REJECTED, reason);
  }

  fulfill(value) {
    this.transition(VALIDATE_STATE.FULFILLED, value);
  }
```

# Reference
- [Promise/A+](https://promisesaplus.com)
- [How to write a Promise/A+ compatible library](https://abdulapopoola.com/2015/02/23/how-to-write-a-promisea-compatible-library/)
