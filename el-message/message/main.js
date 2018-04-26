import Vue from 'vue';
import Main from './main.vue';
import {PopupManager} from 'element-ui/src/utils/popup';
import {isVNode} from 'element-ui/src/utils/vdom';
let MessageConstructor = Vue.extend(Main);//使用基础 Vue 构造器，创建一个“子类”。

let instance;//当前message
let instances = [];//正在显示的所有message
let seed = 1;//用于标记message

const Message = function (options) {
  if (Vue.prototype.$isServer) return;//当前 Vue 实例是否运行于服务器。
  options = options || {};
  if (typeof options === 'string') {
    options = {
      message: options
    };
  }
  let userOnClose = options.onClose;
  let id = 'message_' + seed++;

  // 简单包装一下
  options.onClose = function () {
    Message.close(id, userOnClose);//关闭id的message，并调用回调
  };
  instance = new MessageConstructor({
    data: options
  });
  instance.id = id;
  if (isVNode(instance.message)) {
    instance.$slots.default = [instance.message];//TODO
    instance.message = null;
  }
  instance.vm = instance.$mount();
  instance.vm.visible = true;
  document.body.appendChild(instance.vm.$el);
  instance.dom = instance.vm.$el;
  instance.dom.style.zIndex = PopupManager.nextZIndex();//统一管理 z-index
  instances.push(instance);//加入正在显示的所有message
  return instance.vm;
};

['success', 'warning', 'info', 'error'].forEach(type => {
  Message[type] = options => {
    if (typeof options === 'string') {
      options = {
        message: options
      };
    }
    options.type = type;
    return Message(options);
  };
});

Message.close = function (id, userOnClose) {
  for (let i = 0, len = instances.length; i < len; i++) {
    if (id === instances[i].id) {
      if (typeof userOnClose === 'function') {
        userOnClose(instances[i]);
      }
      instances.splice(i, 1);//从正在显示的所有message中移除id这个message
      break;
    }
  }
};

Message.closeAll = function () {
  for (let i = instances.length - 1; i >= 0; i--) {
    instances[i].close();// 关闭所有message
  }
};

export default Message;
