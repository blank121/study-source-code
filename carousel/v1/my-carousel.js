window.myCarousel = (function () {
  /*
   * {
   *   el://required
   *   urls:[]//required
   *   curIndex:0 //初始显示第几张 0开始
   *   isAutoPlay:true//是否自动播放
   *   cycle:999//切换时间间隔（误差几毫秒）
   *   change:function(newIndex,oldIndex);（即将切换之前的回调）return false表示阻止本次切换
   * }
   * 开放的接口
   * previous()上一张
   * next()下一张
   * jumpTo(i)跳到第几张（i不要超过urls.length哦）
   * */
  var LEFT = 0, RIGHT = 1;

  function initCarousel (options) {
    var urls = []
    var boxes = [];
    var curIndex = 0;
    var isAutoPlay = true;
    var cycle = 2222//ms
    var isMoving = false;//全局状态控制
    var timerId = null;
    var changeCallback = null;
    init(options);
    function init (options) {
      if (!options.el) {
        throw new Error('el does not exist');
      }
      initData(options);
      initDom(options);
      boxes[1].imgEL.src = urls[curIndex];
      buildImgUrl(boxes);
      isAutoPlay && (timerId = setTimeout(autoPlay, cycle))
    }

    function initData (options) {
      curIndex = options.curIndex || 0;
      urls = options.urls;
      isAutoPlay = typeof options.isAutoPlay === 'boolean' ? options.isAutoPlay : true;
      cycle = typeof options.cycle === 'number' ? options.cycle : 2222;
      changeCallback = options.change || noop;
    }

    function initDom (options) {
      var fragment = document.createDocumentFragment();
      var carouselDiv = document.createElement('div');
      carouselDiv.classList.add('carousel');
      fragment.appendChild(carouselDiv);

      var main = document.createElement('main');
      main.classList.add('main');
      carouselDiv.appendChild(main);

      _buildButtons(main);
      _buildImgWrappers(main);
      _buildGuideCircles(main, options.urls.length);
      options.el.appendChild(fragment);

      function _buildButtons (main) {
        //previous
        var previous = document.createElement('div');
        previous.classList.add('previous');
        previous.addEventListener('click', onPrevious);
        var previousBtn = document.createElement('div');
        previousBtn.classList.add('previous-button');
        previous.appendChild(previousBtn);

        //next
        var next = document.createElement('div');
        next.classList.add('next');
        next.addEventListener('click', onNext);
        var nextBtn = document.createElement('div');
        nextBtn.classList.add('next-button');
        next.appendChild(nextBtn);

        main.appendChild(previous);
        main.appendChild(next);
      }

      function _buildImgWrappers (main) {
        for (var i = 1; i <= 3; i += 1) {
          var imgWrapper = document.createElement('div');
          imgWrapper.classList.add('img-wrapper');
          var img = document.createElement('img');
          imgWrapper.appendChild(img);
          main.appendChild(imgWrapper);
          boxes.push(
            {
              el: imgWrapper,
              imgEL: img
            }
          );
        }
        boxes[0].el.classList.add('left');
        boxes[1].el.classList.add('current');
        boxes[2].el.classList.add('right');
      }

      function _buildGuideCircles (main, length) {
        var guide = document.createElement('div');
        guide.classList.add('guide');
        guide.addEventListener('click', guideClickHandler);//委托
        buildIndicators(guide, length);
        initActiveIndicators(guide);
        main.appendChild(guide);

        function buildIndicators (guide, length) {
          var frag = document.createDocumentFragment();
          for (var i = 0; i < length; i++) {
            var div = document.createElement('div');
            div.classList.add('indicator');
            div.dataset.index = i;
            frag.appendChild(div);
          }
          guide.appendChild(frag);
        }
      }
    }

    //TODO
    function guideClickHandler (e) {
      //isNullOrUndefined
      if (isMoving) {
        return;
      }
      if (typeof e.target.dataset.index === 'undefined' || (typeof e.target.dataset.index === 'object' && !e.target.dataset.index)) {
        return;
      }
      terminalPlay(jumpTo, e.target.dataset.index)
    }

    function terminalPlay (cb, arg) {
      isAutoPlay && clearTimeout(timerId);
      cb(arg);
      isAutoPlay && (timerId = setTimeout(autoPlay, cycle))
    }

    function buildImgUrl (boxes) {
      boxes[0].imgEL.src = urls[curIndex === 0 ? urls.length - 1 : curIndex - 1];
      boxes[2].imgEL.src = urls[curIndex === urls.length - 1 ? 0 : curIndex + 1];
      isMoving = false;
    }

    function onNext () {
      terminalPlay(next);
    }

    function onPrevious () {
      terminalPlay(previous);
    }

    //跳到第几张
    function jumpTo (i) {
      var cb = null, arg = null;
      if (i > curIndex) {
        cb = next, arg = i - curIndex;
      } else if (i < curIndex) {
        cb = previous, arg = curIndex - i;
      }

      terminalPlay(cb, arg);
    }

    function previous (step) {//step移动步数
      if (isMoving) {
        return;
      }
      !step && step !== 0 && (step = 1);//step不存在，默认移动1一步

      var oldIndex = curIndex;
      curIndex = curIndex - step;
      curIndex < 0 && (curIndex += urls.length)

      if (changeCallback(curIndex, oldIndex) === false) {
        return;
      }

      var footer = boxes.pop();
      boxes.unshift(footer);

      move(boxes, LEFT);
    }

    function next (step) {
      if (isMoving) {
        return;
      }
      !step && step !== 0 && (step = 1);//i不存在，默认移动1一步

      var oldIndex = curIndex;
      curIndex = curIndex + step;
      if (curIndex >= urls.length) {
        curIndex -= urls.length
      }
      if (changeCallback(curIndex, oldIndex) === false) {
        return;
      }
      var head = boxes.shift();
      boxes.push(head);
      move(boxes, RIGHT);
    }
    //执行切换 入口只有next和previous
    function move (boxes, direction) {
      isMoving = true;
      boxes[1].imgEL.src = urls[curIndex];//先渲染主图

      var leftNode = boxes[0].el;
      leftNode.style.visibility = direction === RIGHT ? 'visible' : 'hidden';
      !leftNode.classList.contains('left') && leftNode.classList.add('left');
      leftNode.classList.remove('current');
      leftNode.classList.remove('right');

      var currentNode = boxes[1].el;
      currentNode.style.visibility = 'visible';
      !currentNode.classList.contains('current') && currentNode.classList.add('current');
      currentNode.classList.remove('left');
      currentNode.classList.remove('right');

      var rightNode = boxes[2].el;
      rightNode.style.visibility = direction === LEFT ? 'visible' : 'hidden';
      !rightNode.classList.contains('right') && rightNode.classList.add('right');
      rightNode.classList.remove('left');
      rightNode.classList.remove('current');
      var guide = boxes[0].el.parentNode.querySelector('.guide');

      initActiveIndicators(guide);
      setTimeout(buildImgUrl, 500, boxes);
    }

    function initActiveIndicators (guide) {
      guide.querySelectorAll('[data-index]').forEach(function (item) {
        var index = stringToNumber(item.dataset.index);
        if (index === curIndex) {
          item.style.borderColor = '#328bff';
        } else {
          item.style.borderColor = 'white';
        }
      })
    }

    function autoPlay () {
      if (isMoving) {
        return;
      }
      next();
      isAutoPlay && (timerId = setTimeout(autoPlay, cycle))
    }

    return {
      jumpTo: jumpTo,//考虑如果ismoveing;拦截了怎么办,维护一个调用队列？
      next: onNext,
      previous: onPrevious
    }
  }

  function noop () {
  }

  function stringToNumber (str) {
    if (typeof str === 'number') {
      return str;
    }
    if (typeof str !== 'string') {
      throw new Error('str is not a string');
    }
    return Number(str);
  }

  function init (option) {
    return initCarousel(option);
  }

  return {
    init: init
  }
})()
