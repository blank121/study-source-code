import {
  objectOrFunction,
  isFunction
} from './utils';

import {
  asap
} from './asap';

import originalThen from './then';
import originalResolve from './promise/resolve';

export const PROMISE_ID = Math.random().toString(36).substring(2);

function noop () {
}

const PENDING = void 0;
const FULFILLED = 1;
const REJECTED = 2;

const TRY_CATCH_ERROR = {error: null};

function selfFulfillment () {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn () {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen (promise) {
  try {
    return promise.then;
  } catch (error) {
    TRY_CATCH_ERROR.error = error;
    return TRY_CATCH_ERROR;
  }
}

/*
 * value:thenable
 * */
function tryThen (then, value, fulfillmentHandler, rejectionHandler) {
  try {//调用传入的value的then方法
    then.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

/*
 * thenable 是函数，有then方法
 * */

//handleForeignThenable(promise, maybeThenable, then);
function handleForeignThenable (promise, thenable, then) {
  asap(promise => {//asap这里默认分析 setTimeout(fn,0) 下一轮任务开始时执行
    var sealed = false;//是否有结果
    //value:thenable传入的参数 ，尝试执行
    var error = tryThen(then, thenable, value => {//fullfill时，
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {//如果不是直接resolve原对象
        resolve(promise, value);//继续对resolve的val进行resolve处理
      } else {
        fulfill(promise, value);
      }
    }, reason => {//reject
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {//tryThen抛错
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable (promise, thenable) {
  if (thenable._state === FULFILLED) {//已完成
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {//已拒绝
    reject(promise, thenable._result);
  } else {//thenable 增加订阅回调
    subscribe(thenable, undefined, value => resolve(promise, value),
      reason => reject(promise, reason))
  }
}

/*maybeThenable:value;then:value.then*/
function handleMaybeThenable (promise, maybeThenable, then) {//thenable obj or promise
  /* originalThen : 定义的原始then;originalResolve：原始resolve*/
  if (maybeThenable.constructor === promise.constructor && //判断是否是promise且没经修改原生方法
    then === originalThen && maybeThenable.constructor.resolve === originalResolve) {
    handleOwnThenable(promise, maybeThenable);//maybeThenable是一个原生的promise
  } else {//maybeThenable
    if (then === TRY_CATCH_ERROR) {// getThen 抛错
      reject(promise, TRY_CATCH_ERROR.error);
      TRY_CATCH_ERROR.error = null;//释放引用
    } else if (then === undefined) {//若不是一个thenable，直接完成态
      fulfill(promise, maybeThenable);
    } else if (isFunction(then)) {//若是一个thenable
      handleForeignThenable(promise, maybeThenable, then);
    } else {//若不是一个thenable，直接完成态
      fulfill(promise, maybeThenable);//改变promise 状态为完成态  同时设置result
    }
  }
}

// 通用的resolve方法 继续传递执行
function resolve (promise, value) {
  if (promise === value) {//如果resolve原对象
    reject(promise, selfFulfillment());//设置rejected状态
  } else if (objectOrFunction(value)) {//如果val 是对象或函数
    handleMaybeThenable(promise, value, getThen(value));//getThen(value) 获取val.then方法
  } else {//not obj or not fnc
    fulfill(promise, value);//设置pending result val
  }
}

function publishRejection (promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

//改变promise 状态为FULFILLED(完成状态)  同时设置result
function fulfill (promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {//通知
    asap(publish, promise);
  }
}

// 通用的reject方法
function reject (promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);//as soon as possible
}

/*
 * parent:thenable
 * child : undefined or other
 * */
//subscribe(parent, child, onFulfillment, onRejection);
//如果promise仍是pending,则将回调函数加入_subscribers等待通知
function subscribe (parent, child, onFulfillment, onRejection) {
  let {_subscribers} = parent;//取注册的所有订阅
  let {length} = _subscribers;

  parent._onerror = null;

  _subscribers[length] = child;//扩充订阅  3个一循环
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  /*
  * 1、如果之前有订阅且状态是pending， 订阅就好了，等待resolve完成时的发布通知执行就好
  * 2、如果之前有订阅且状态不是pending，继续加入订阅就好，length=0时已经准备调度发布了，pulish执行时会清空。此时不为0说明未publish
  * 3、如果之前无订阅且状态是pending，订阅就好了，等待resolve完成时的发布通知执行就好
  * 4、如下，赶紧调度执行获取结果
  * */
  if (length === 0 && parent._state) {//如果之前没有订阅且thenable已不是pending，
    asap(publish, parent);
  }
}

function publish (promise) {
  let subscribers = promise._subscribers;
  let settled = promise._state;

  //没有订阅者
  if (subscribers.length === 0) {
    return;
  }

  let child, callback, detail = promise._result;

  //这里i+=3 是因为then注册时 i是promise,i+1是resolve,i+2是reject
  for (let i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }
  //通知完毕，清除订阅
  promise._subscribers.length = 0;
}


function tryCatch (callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

//asap(() => invokeCallback(_state, child, callback, parent._result));
//执行回调：
function invokeCallback (settled, promise, callback, detail) {
  let hasCallback = isFunction(callback),
    value, error, succeeded, failed;

  if (hasCallback) {
    value = tryCatch(callback, detail);//尝试执行使用者then（）传入的回调，成功时value 是then（）注册的回调方法的返回值

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {//若return this
      reject(promise, cannotReturnOwn());
      return;
    }

  } else {// then 未传入相关回调，继续传递
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
    resolve(promise, value);//value 可能为thenable
  } else if (failed) {//有cb 且失败
    reject(promise, error);
  } else if (settled === FULFILLED) {//无cb
    fulfill(promise, value);
  } else if (settled === REJECTED) {//无cb
    reject(promise, value);
  }
}


/**
 * @param promise:promise对象
 * @param resolver:new Promise(resolver)
 * @return
 */
// 初始化promise new时调用
//initializePromise(this, resolver)
function initializePromise (promise, resolver) {
  try {
    //执行resolver 传入回调
    resolver(function resolvePromise (value) {//resolvePromise:使用者的回调
      resolve(promise, value);
    }, function rejectPromise (reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

let id = 0;

function nextId () {
  return id++;
}

function makePromise (promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

export {
  nextId,
  makePromise,
  getThen,
  noop,
  resolve,
  reject,
  fulfill,
  subscribe,
  publish,
  publishRejection,
  initializePromise,
  invokeCallback,
  FULFILLED,
  REJECTED,
  PENDING,
  handleMaybeThenable
};
