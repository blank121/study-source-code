import {
  isFunction
} from './utils';
import {
  noop,
  nextId,
  PROMISE_ID,
  initializePromise
} from './-internal';
import {
  asap,
  setAsap,
  setScheduler
} from './asap';

import all from './promise/all';
import race from './promise/race';
import Resolve from './promise/resolve';
import Reject from './promise/reject';
import then from './then';

function needsResolver () {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew () {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}


// finally catch constructor
class Promise {
  constructor (resolver) {
    this[PROMISE_ID] = nextId(); //生成id
    this._result = this._state = undefined;
    this._subscribers = [];//订阅者

    //一般使用时，new时立即执行一次使用者传入的resolver，印证了一旦promise开始执行无法暂停
    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();//调用resolver
    }
  }

  catch (onRejection) {
    return this.then(null, onRejection);
  }

  // finally 相当于对当前promise注册resolve和reject两种监听
  //如果为 resolve 执行一次cb 然后把原来的value继续传递
  finally (callback) {
    let promise = this;
    let constructor = promise.constructor;

    return promise.then(value => constructor.resolve(callback()).then(() => value),
      reason => constructor.resolve(callback()).then(() => {
        throw reason;
      }));
  }
}

Promise.prototype.then = then;
export default Promise;
Promise.all = all;
Promise.race = race;
Promise.resolve = Resolve;
Promise.reject = Reject;
Promise._setScheduler = setScheduler;
Promise._setAsap = setAsap;
Promise._asap = asap;

