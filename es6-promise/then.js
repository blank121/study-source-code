import {
  invokeCallback,
  subscribe,
  FULFILLED,
  REJECTED,
  noop,
  makePromise,
  PROMISE_ID
} from './-internal';

import { asap } from './asap';

export default function then(onFulfillment, onRejection) {
  const parent = this;


  const child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {//为什么判断PROMISE_ID TODO
    makePromise(child);//初始化基本的promie 属性
  }
  //promise state
  const { _state } = parent;

  if (_state) {// not pending
    const callback = arguments[_state - 1];
    asap(() => invokeCallback(_state, child, callback, parent._result));
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }
  //then reuturn的新promise
  return child;
}
