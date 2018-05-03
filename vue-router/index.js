/* @flow */

import {install} from './install'
import {START} from './util/route'
import {assert} from './util/warn'
import {inBrowser} from './util/dom'
import {cleanPath} from './util/path'
import {createMatcher} from './create-matcher'
import {normalizeLocation} from './util/location'
import {supportsPushState} from './util/push-state'

import {HashHistory} from './history/hash'
import {HTML5History} from './history/html5'
import {AbstractHistory} from './history/abstract'

import type {Matcher} from './create-matcher'

/* 导出的VueRouter对象，用来包装store */
export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor (options: RouterOptions = {}) {
/*    Vue instance
    配置了 router 的 Vue 根实例。*/
    this.app = null
    /* 保存vm实例 */
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []

    // 解析路由记录 创建 match 匹配函数。
    this.matcher = createMatcher(options.routes || [], this)

    let mode = options.mode || 'hash' // hash || history|| abstract

    //fallback :当浏览器不支持 history.pushState 控制路由是否应该回退到 hash 模式。默认值为 true。
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {
      mode = 'hash'
    }
    //不是浏览器端
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode

    //base:应用的基路径。例如，如果整个单页应用服务在 /app/ 下，然后 base 就应该设为 "/app/"。
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  match (raw: RawLocation,
         current?: Route,
         redirectedFrom?: Location): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  // Route
  // 当前路由对应的路由信息对象。
  get currentRoute (): ?Route {
    return this.history && this.history.current
  }

  /* 初始化 */
  init (app: any /* Vue component instance */) {
    /* 未安装就调用init会抛出异常 */
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    /* 将当前vm实例保存在app中 */
    this.apps.push(app)

    // main app already initialized.
    /* 已存在说明已经被init过了，直接返回 */
    if (this.app) {
      return
    }

    /* this.app保存当前vm实例 */
    this.app = app

    const history = this.history

    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      )
    }

    // this.cb = cb
    history.listen(route => {
      this.apps.forEach((app) => {
        //响应式的 _route 属性,如果该属性值发生了变化,就会触发更新机制，继而调用应用实例的 render 重新渲染
        app._route = route
      })
    })
  }

  beforeEach (fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve (fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach (fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  onReady (cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }


// 注册一个回调，该回调会在路由导航过程中出错时被调用。注意被调用的错误必须是下列情形中的一种：
// 错误在一个路由守卫函数中被同步抛出；
// 错误在一个路由守卫函数中通过调用 next(err) 的方式异步捕获并处理；
// 渲染一个路由的过程中，需要尝试解析一个异步组件时发生错误。
  onError (errorCb: Function) {
    this.history.onError(errorCb)
  }
  //实际是调用具体history对象的方法
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }
  //实际是调用具体history对象的方法
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }

  go (n: number) {
    this.history.go(n)
  }

  back () {
    this.go(-1)
  }

  forward () {
    this.go(1)
  }

  getMatchedComponents (to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  resolve (to: RawLocation,
           current?: Route,
           append?: boolean): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    const location = normalizeLocation(
      to,
      current || this.history.current,
      append,
      this
    )
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  addRoutes (routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

function registerHook (list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

function createHref (base: string, fullPath: string, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

/* Vue.use安装插件时候需要暴露的install方法 */
VueRouter.install = install
VueRouter.version = '__VERSION__'

/* 兼容用script标签引用的方法 */
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
