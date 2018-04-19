import {
  invokeCallback,
  subscribe,
  FULFILLED,
  REJECTED,
  noop,
  makePromise,
  PROMISE_ID
} from './-internal';

import {asap} from './asap';

export default function then (onFulfillment, onRejection) {
  const parent = this;

  //新建一个不执行的promise对象用于返回结果，可链式调用
  const child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {//TODO
    makePromise(child);//初始化基本的promie 属性
  }
  //promise state
  const {_state} = parent;

  if (_state) {// 如果状态已完成或已拒绝，无需订阅，直接返回结果，印证了一旦promise有了结果无法再次改变
    const callback = arguments[_state - 1];
    asap(() => invokeCallback(_state, child, callback, parent._result));
  } else {//订阅来注册回调
    subscribe(parent, child, onFulfillment, onRejection);
  }
  //then reuturn的新promise
  return child;
}
