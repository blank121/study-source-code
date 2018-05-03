// 函数防抖（debounce）
// 使用场景：现在我们需要做一个搜索框，当用户输入文字，执行keyup事件的时候，需要发出异步请求去进行结果查询。但如果用户快速输入了一连串字符，例如是5个字符，那么此时会瞬间触发5次请求，这肯定不是我们希望的结果。我们想要的是用户停止输入的时候才去触发查询的请求，这个时候函数防抖可以帮到我们
//
// 原理：让函数在上次执行后，满足等待某个时间内不再触发次函数后再执行，如果触发则等待时间重新计算
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.

// example:
// var lazyLayout = _.debounce(calculateLayout, 300);
// $(window).resize(lazyLayout);
function debounce (func, wait, immediate) {
  var timeout, result;

  var later = function (context, args) {
    timeout = null;//重置
    if (args) result = func.apply(context, args);
  };

  var debounced = restArguments(function (args) {
    if (timeout) clearTimeout(timeout);//如果触发则等待时间重新计算
    if (immediate) {//应用场景,比如提交表单，需要立即执行一次
      var callNow = !timeout;//是否为第一次触发，如果是第一次触发，timeout是undefined
      timeout = setTimeout(later, wait);//注意，这里没有args，仅仅只是在wait毫秒后重置清空timeout，
      if (callNow) result = func.apply(this, args);//如果是immediate且是第一次触发，立即执行一次；result为立即执行的结果，这里this直接绑定到用户的func
    } else {
      timeout = delay(later, wait, this, args);//settimeout，注意：这里的this通过参数传给later绑定到func
    }

    return result;
  });

  //重置，取消执行
  debounced.cancel = function () {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
};


// 函数节流（throttle）
// 使用场景：window.onscroll，以及window.onresize等，每间隔某个时间去执行某函数，避免函数的过多执行
//
// 原理：与函数防抖不同，它不是要在每完成某个等待时间后去执行某个函数，而是要每间隔某个时间去执行某个函数
// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time. Normally, the throttled function will run
// as much as it can, without ever going more than once per `wait` duration;
// but if you'd like to disable the execution on the leading edge, pass
// `{leading: false}`. To disable execution on the trailing edge, ditto.

//   leading：是否立即执行
//   trailing: true // wait期间如果再次调用，是否会在周期后边缘(wait刚结束)再次执行

//leading = true;trailing = true; 调用立即执行一次，wait期间如果再次调用，会在周期后边缘(wait刚结束)再次执行
//leading = true;trailing = false; 调用立即执行一次，wait期间如果再次调用，什么也不做
//leading = false;trailing = true; 调用需等待wait时间，wait期间如果再次调用，会在周期后边缘(wait刚结束)执行
//leading = false;trailing = false; 调用需等待wait时间，wait期间如果再次调用，什么也不做
function throttle (func, wait, options) {
  var timeout, context, args, result;
  var previous = 0;//上次执行时间
  if (!options) options = {};

  var later = function () {
    previous = options.leading === false ? 0 : _.now();//设置为0的话下次调用会立即执行
    timeout = null;
    result = func.apply(context, args);//可能设置timeout?
    if (!timeout) context = args = null;
  };

  var throttled = function () {
    var now = _.now();
    if (!previous && options.leading === false) previous = now;//如果不是立即执行
    var remaining = wait - (now - previous);//剩余时间
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {//开始执行
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;//记录执行时间
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);//注意只有这个地方对timeout赋值了且调用了later
    }
    return result;
  };

  //取消
  throttled.cancel = function () {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
};

delay = restArguments(function (func, wait, args) {
  return setTimeout(function () {
    return func.apply(null, args);
  }, wait);
});
//获取剩余参数,不传startIndex最后一个参数收集其余参数
function restArguments (func, startIndex) {//定义的func.length形参个数
  startIndex = startIndex == null ? func.length - 1 : +startIndex;
  return function () {
    var length = Math.max(arguments.length - startIndex, 0),
      rest = Array(length),//1
      index = 0;
    for (; index < length; index++) {
      rest[index] = arguments[index + startIndex];
    }
    switch (startIndex) {
      case 0://func就一个参数
        return func.call(this, rest);
      case 1:
        return func.call(this, arguments[0], rest);
      case 2:
        return func.call(this, arguments[0], arguments[1], rest);
    }
    var args = Array(startIndex + 1);
    for (index = 0; index < startIndex; index++) {
      args[index] = arguments[index];
    }
    args[startIndex] = rest;//[arguments[0],arguments[1],arguments[2]...rest]
    return func.apply(this, args);
  };
};
