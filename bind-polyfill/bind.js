Function.prototype.bind = function (oThis) {
  if (typeof this !== "function") {
    // 可能的与 ECMAScript 5 内部的 IsCallable 函数最接近的东西，
    throw new TypeError("Function.prototype.bind - what " +
      "is trying to be bound is not callable"
    );
  }

  var aArgs = Array.prototype.slice.call(arguments, 1),//返回[1,length)的元素组成的数组
    fToBind = this,
    fNOP = function () {
    },
    fBound = function () {
      return fToBind.apply(
        (
          this instanceof fNOP &&//允许new进行覆盖的部分，如果this的原型链中找到了fNOP，说明使用了new
          oThis ? this : oThis
        ),
        //arguments:fBound的arguments；此举目的是合并两次调用的传参
        // 获取调用时(fBound)的传参.bind 返回的函数入参往往是这么传递的
        aArgs.concat(Array.prototype.slice.call(arguments))
      );
    }
  ;

  fNOP.prototype = this.prototype;//维护原型,为了new的this覆盖
  fBound.prototype = new fNOP();

  return fBound;
};
