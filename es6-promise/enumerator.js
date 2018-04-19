import {
  isArray,
  isMaybeThenable
} from './utils';
import {
  noop,
  reject,
  fulfill,
  subscribe,
  FULFILLED,
  REJECTED,
  PENDING,
  getThen,
  handleMaybeThenable
} from './-internal';

import then from './then';
import Promise from './promise';
import originalResolve from './promise/resolve';
import originalThen from './then';
import {makePromise, PROMISE_ID} from './-internal';

function validationError () {
  return new Error('Array Methods must be provided an Array');
};

export default class Enumerator {
  constructor (Constructor, input) {
    this._instanceConstructor = Constructor;
    //新的promise 比如Promise.all([...])会返回一个
    this.promise = new Constructor(noop);

    if (!this.promise[PROMISE_ID]) {
      makePromise(this.promise);
    }

    if (isArray(input)) {
      this.length = input.length;
      this._remaining = input.length;//promise总数量

      this._result = new Array(this.length);//每个promise结果

      if (this.length === 0) {
        fulfill(this.promise, this._result);
      } else {
        this.length = this.length || 0;
        this._enumerate(input);
        if (this._remaining === 0) {//都执行完毕
          fulfill(this.promise, this._result);
        }
      }
    } else {
      reject(this.promise, validationError());//传入不是array reject it
    }
  }

  _enumerate (input) {
    for (let i = 0; this._state === PENDING && i < input.length; i++) {//Enumerator _state？？ TODO
      this._eachEntry(input[i], i);
    }
  }

  //处理所有的输入
  _eachEntry (entry, i) {
    let c = this._instanceConstructor;
    let {resolve} = c;//Promise.resolve

    if (resolve === originalResolve) {
      let then = getThen(entry);//获取then方法

      if (then === originalThen &&
        entry._state !== PENDING) {
        this._settledAt(entry._state, i, entry._result);
      } else if (typeof then !== 'function') {
        this._remaining--;//不是thenable 直接完成该entry
        this._result[i] = entry;
      } else if (c === Promise) {//不是promise但是thenable
        let promise = new c(noop);
        handleMaybeThenable(promise, entry, then);
        this._willSettleAt(promise, i);//暂时状态不确定，订阅之
      } else {
        this._willSettleAt(new c(resolve => resolve(entry)), i);
      }
    } else {
      this._willSettleAt(resolve(entry), i);
    }
  }

  _settledAt (state, i, value) {
    let {promise} = this;

    if (promise._state === PENDING) {
      this._remaining--;

      if (state === REJECTED) {
        reject(promise, value);//如果传入列表有一个rejected，立即设置promise结果
      } else {
        this._result[i] = value;
      }
    }

    if (this._remaining === 0) {//全部处理完成fulfill
      fulfill(promise, this._result);
    }
  }

  _willSettleAt (promise, i) {
    let enumerator = this;
    //暂时状态不确定，订阅之
    subscribe(
      promise, undefined,
      value => enumerator._settledAt(FULFILLED, i, value),//回调，设置promise状态
      reason => enumerator._settledAt(REJECTED, i, reason)
    );
  }
};
