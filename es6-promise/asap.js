let len = 0;//回调队列长度
let vertxNext;
let customSchedulerFn;
//下一轮事件循环执行
export var asap = function asap (callback, arg) {
  queue[len] = callback;//2个一组
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    /*
     如果队列长度是2 ，那意味着我们需要调度一次队列flush,
     如果队列flush完成前有其他的回调进入队列，这些进入的回调会在当前已调度的flush执行
     * */

    // If len is 2, that means that we need to schedule（调度） an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {//一般默认
      scheduleFlush();
    }
  }
}

export function setScheduler (scheduleFn) {
  customSchedulerFn = scheduleFn;
}

export function setAsap (asapFn) {
  asap = asapFn;
}

const browserWindow = (typeof window !== 'undefined') ? window : undefined;
const browserGlobal = browserWindow || {};
const BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
const isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
const isWorker = typeof Uint8ClampedArray !== 'undefined' &&
  typeof importScripts !== 'undefined' &&
  typeof MessageChannel !== 'undefined';

// node
function useNextTick () {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return () => process.nextTick(flush);
}

// vertx
function useVertxTimer () {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver () {
  let iterations = 0;
  const observer = new BrowserMutationObserver(flush);
  const node = document.createTextNode('');
  observer.observe(node, {characterData: true});

  return () => {
    node.data = (iterations = ++iterations % 2);
  };
}

// web worker
function useMessageChannel () {
  const channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return () => channel.port2.postMessage(0);
}

function useSetTimeout () {
  //缓存 setTimeout引用来避免promise受到其他可能修改setTimeout的库的影响
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  const globalSetTimeout = setTimeout;
  return () => globalSetTimeout(flush, 1);
}

const queue = new Array(1000);
function flush () {
  for (let i = 0; i < len; i += 2) {
    let callback = queue[i];
    let arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;//666
}

function attemptVertx () {
  try {
    const vertx = Function('return this')().require('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

let scheduleFlush;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}
