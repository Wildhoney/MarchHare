var global, factory;
((global = this),
  (factory = function (e, t, n, r, o) {
    "use strict";
    function i(e) {
      const t = Object.create(null, {
        [Symbol.toStringTag]: { value: "Module" },
      });
      if (e)
        for (const n in e)
          if ("default" !== n) {
            const r = Object.getOwnPropertyDescriptor(e, n);
            Object.defineProperty(
              t,
              n,
              r.get ? r : { enumerable: !0, get: () => e[n] },
            );
          }
      return ((t.default = e), Object.freeze(t));
    }
    const s = i(r);
    class c {
      static Mount = Symbol("chizu.action.lifecycle/Mount");
      static Node = Symbol("chizu.action.lifecycle/Node");
      static Unmount = Symbol("chizu.action.lifecycle/Unmount");
      static Error = Symbol("chizu.action.lifecycle/Error");
      static Update = Symbol("chizu.action.lifecycle/Update");
    }
    var u = ((e) => ((e.Unicast = "unicast"), (e.Broadcast = "broadcast"), e))(
        u || {},
      ),
      a = ((e) => (
        (e.Mounting = "mounting"),
        (e.Mounted = "mounted"),
        (e.Unmounting = "unmounting"),
        (e.Unmounted = "unmounted"),
        e
      ))(a || {});
    const l = Symbol("payload"),
      f = Symbol("distributed"),
      d = Symbol("actionSymbol"),
      p = Symbol("channel");
    var h = ((e) => (
      (e[(e.Timedout = 0)] = "Timedout"),
      (e[(e.Supplanted = 1)] = "Supplanted"),
      (e[(e.Disallowed = 2)] = "Disallowed"),
      (e[(e.Errored = 3)] = "Errored"),
      (e[(e.Unmounted = 4)] = "Unmounted"),
      e
    ))(h || {});
    class y extends Error {
      name = "AbortError";
      constructor(e = "Aborted") {
        super(e);
      }
    }
    const m = {
      actionPrefix: "chizu.action/",
      distributedActionPrefix: "chizu.action/distributed/",
      channelPrefix: "chizu.channel/",
    };
    function b(e, t) {
      return new Promise((n, r) => {
        if (t?.aborted) return void r(new y());
        const o = setTimeout(n, e);
        t?.addEventListener(
          "abort",
          () => {
            (clearTimeout(o), r(new y()));
          },
          { once: !0 },
        );
      });
    }
    function v(e) {
      return e
        ? Boolean(e && "symbol" != typeof e)
        : Symbol(`pk.${Date.now()}.${crypto.randomUUID()}`);
    }
    const g = Object.freeze(
      Object.defineProperty(
        { __proto__: null, config: m, pk: v, sleep: b, ζ: b, κ: v },
        Symbol.toStringTag,
        { value: "Module" },
      ),
    );
    function w(e) {
      return t.G.isString(e) || "symbol" == typeof e
        ? e
        : (t.G.isObject(e) || "function" == typeof e) && d in e
          ? e[d]
          : e;
    }
    function x(e) {
      if (t.G.isString(e)) return e.startsWith(m.distributedActionPrefix);
      if ("symbol" == typeof e)
        return e.description?.startsWith(m.distributedActionPrefix) ?? !1;
      if (t.G.isObject(e) || "function" == typeof e) {
        if (f in e && e[f]) return !0;
        if (d in e) {
          const t = e[d];
          return t.description?.startsWith(m.distributedActionPrefix) ?? !1;
        }
      }
      return !1;
    }
    function j(e) {
      const n = w(e),
        r = t.G.isString(n) ? n : (n.description ?? "");
      return (
        (r.startsWith(m.actionPrefix) && r.slice(r.lastIndexOf("/") + 1)) ||
        "unknown"
      );
    }
    function E(e) {
      return t.G.isObject(e) && p in e && "channel" in e;
    }
    function O(e) {
      if (e instanceof Error) {
        if ("TimeoutError" === e.name) return h.Timedout;
        if ("AbortError" === e.name) return h.Supplanted;
      }
      return h.Errored;
    }
    function S(e) {
      return e instanceof Error ? e : new Error(String(e));
    }
    const P = r.createContext(void 0);
    let A = (e = 21) => {
      let t = "",
        n = crypto.getRandomValues(new Uint8Array((e |= 0)));
      for (; e--; )
        t += "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict"[
          63 & n[e]
        ];
      return t;
    };
    var _ = ((e) => (
        (e[(e.Add = 1)] = "Add"),
        (e[(e.Remove = 2)] = "Remove"),
        (e[(e.Update = 4)] = "Update"),
        (e[(e.Move = 8)] = "Move"),
        (e[(e.Replace = 16)] = "Replace"),
        (e[(e.Sort = 32)] = "Sort"),
        e
      ))(_ || {}),
      G = ((e) => (
        (e[(e.Produce = 0)] = "Produce"),
        (e[(e.Hydrate = 1)] = "Hydrate"),
        e
      ))(G || {}),
      M = ((e) => (
        (e.Property = "property"),
        (e.Process = "process"),
        (e.Value = "value"),
        (e.Operation = "operation"),
        e
      ))(M || {});
    class N {
      [o.immerable] = !0;
      static keys = new Set(Object.values(M));
      property = null;
      process = null;
      value;
      operation;
      constructor(e, t) {
        ((this.value = e), (this.operation = t));
      }
      assign(e, t) {
        const n = new N(this.value, this.operation);
        return ((n.property = e), (n.process = t), n);
      }
    }
    class k {
      static immer = (() => {
        o.enablePatches();
        const e = new o.Immer();
        return (e.setAutoFreeze(!1), e);
      })();
      static tag = "κ";
      static id = A;
    }
    function C(e, t) {
      const n = "string" == typeof t ? ("" === t ? [] : t.split(".")) : t;
      let r = e;
      for (const o of n) {
        if (null == r) return;
        r = r[o];
      }
      return r;
    }
    function U(e) {
      if (t.G.isNullable(e) || z(e)) return e;
      if (t.G.isArray(e)) return e.map((e) => U(e));
      if (t.G.isObject(e)) {
        const t = Object.entries(e).map(([e, t]) => [e, U(t)]);
        return { ...Object.fromEntries(t), [k.tag]: e[k.tag] ?? k.id() };
      }
      return e;
    }
    function R(e) {
      if (Array.isArray(e))
        return e
          .filter((e) => k.tag in e)
          .map((e) => e[k.tag] ?? "")
          .join(",");
      const t = e[k.tag];
      if (t) return t;
      try {
        return JSON.stringify(e);
      } catch {
        return `[unserializable:${typeof e}]`;
      }
    }
    function z(e) {
      return (
        t.G.isNullable(e) ||
        t.G.isString(e) ||
        t.G.isNumber(e) ||
        t.G.isBoolean(e) ||
        "symbol" == typeof e ||
        "bigint" == typeof e
      );
    }
    function T(e, n, r, o, i, s) {
      return (function c(u, a = n.path) {
        if (u instanceof N) {
          const n = C(r, a.join("."));
          if (
            (Object.entries(u)
              .filter(([e, t]) => !N.keys.has(e) && t instanceof N)
              .forEach(([e, t]) => c(t, a.concat(e))),
            z(u.value))
          ) {
            if (e === G.Hydrate) return u.value;
            const c = a.slice(0, -1),
              l = c.length > 0 ? C(r, c.join(".")) : r;
            return (
              t.G.isNullable(l) || L(l, u, a.at(-1), o, i, s),
              n ?? u.value
            );
          }
          if (e === G.Hydrate) {
            const e = U(c(u.value, a));
            return (L(e, u, null, o, i, s), e);
          }
          const l = n ?? U(u.value);
          return (
            L(l, u, null, o, i, s),
            t.G.isNullable(n) ? l : (c(u.value, a), n)
          );
        }
        if (t.G.isArray(u)) return u.map((e, t) => c(e, a.concat(t)));
        if (t.G.isObject(u)) {
          const t = Object.entries(u).map(([e, t]) => [e, c(t, a.concat(e))]),
            n = Object.fromEntries(t);
          if (e === G.Hydrate) {
            const e = U(n);
            return (
              Object.entries(u).forEach(([t, n]) => {
                n instanceof N && z(n.value) && L(e, n, t, o, i, s);
              }),
              e
            );
          }
          return n;
        }
        return u;
      })(n.value);
    }
    function L(e, t, n, r, o, i) {
      const s = i(e),
        c = o.get(s) ?? [];
      o.set(s, [t.assign(n, r), ...c]);
    }
    class B {
      #e = {};
      #t;
      #n = new Map();
      #r = new Set();
      #o = !1;
      constructor(e = R) {
        this.#t = e;
      }
      static pk() {
        return A();
      }
      static κ = B.pk;
      annotate(e, t) {
        return new N(t, e);
      }
      δ = this.annotate;
      get model() {
        return this.#e;
      }
      get inspect() {
        return (function (e, n, r, o, i) {
          function s(o) {
            const i = o.at(-1),
              s = C(e(), o),
              c = o.slice(0, -1),
              u = t.A.isNotEmpty(c) ? C(e(), c) : e();
            return [
              ...(t.G.isObject(s) || t.G.isArray(s)
                ? (n.get(r(s))?.filter((e) => t.G.isNullable(e.property)) ?? [])
                : []),
              ...(t.G.isObject(u)
                ? (n.get(r(u))?.filter((e) => e.property === i) ?? [])
                : []),
            ];
          }
          return (function n(r) {
            return new Proxy(() => {}, {
              get: (c, u) =>
                "pending" === u
                  ? () => !t.A.isEmpty(s(r))
                  : "remaining" === u
                    ? () => t.A.length(s(r))
                    : "box" === u
                      ? () => ({ value: C(e(), r), inspect: n(r) })
                      : "is" === u
                        ? (e) => s(r).some((t) => 0 !== (t.operation & e))
                        : "draft" === u
                          ? () => t.A.head(s(r))?.value ?? C(e(), r)
                          : "settled" === u
                            ? () =>
                                new Promise((n) => {
                                  if (t.A.isEmpty(s(r))) return n(C(e(), r));
                                  const c = () => {
                                    t.A.isEmpty(s(r)) && (i(c), n(C(e(), r)));
                                  };
                                  o(c);
                                })
                            : n([...r, String(u)]),
            });
          })([]);
        })(
          () => this.#e,
          this.#n,
          this.#t,
          (e) => this.#r.add(e),
          (e) => this.#r.delete(e),
        );
      }
      hydrate(e) {
        return ((this.#o = !0), this.#i(G.Hydrate, (t) => Object.assign(t, e)));
      }
      produce(e) {
        if (!this.#o)
          throw new Error(
            "State must be hydrated using hydrate() before calling produce()",
          );
        return this.#i(G.Produce, e);
      }
      #i(e, t) {
        const n = Symbol("process"),
          [, r] = k.immer.produceWithPatches(this.#e, t);
        return (
          (this.#e = r.reduce(
            (t, r) =>
              k.immer.applyPatches(t, [
                { ...r, value: T(e, r, t, n, this.#n, this.#t) },
              ]),
            this.#e,
          )),
          (this.#e = U(this.#e)),
          this.#s(),
          n
        );
      }
      prune(e) {
        (this.#n.forEach((n, r) => {
          const o = n.filter((t) => t.process !== e);
          t.A.isEmpty(o) ? this.#n.delete(r) : this.#n.set(r, o);
        }),
          this.#s());
      }
      #s() {
        this.#r.forEach((e) => e());
      }
      observe(e) {
        const t = () => e(this.#e);
        return (this.#r.add(t), () => this.#r.delete(t));
      }
    }
    function D(e) {
      return e &&
        e.__esModule &&
        Object.prototype.hasOwnProperty.call(e, "default")
        ? e.default
        : e;
    }
    var H,
      W = { exports: {} },
      $ =
        (H ||
          ((H = 1),
          (function (e) {
            var t = Object.prototype.hasOwnProperty,
              n = "~";
            function r() {}
            function o(e, t, n) {
              ((this.fn = e), (this.context = t), (this.once = n || !1));
            }
            function i(e, t, r, i, s) {
              if ("function" != typeof r)
                throw new TypeError("The listener must be a function");
              var c = new o(r, i || e, s),
                u = n ? n + t : t;
              return (
                e._events[u]
                  ? e._events[u].fn
                    ? (e._events[u] = [e._events[u], c])
                    : e._events[u].push(c)
                  : ((e._events[u] = c), e._eventsCount++),
                e
              );
            }
            function s(e, t) {
              0 === --e._eventsCount
                ? (e._events = new r())
                : delete e._events[t];
            }
            function c() {
              ((this._events = new r()), (this._eventsCount = 0));
            }
            (Object.create &&
              ((r.prototype = Object.create(null)),
              new r().__proto__ || (n = !1)),
              (c.prototype.eventNames = function () {
                var e,
                  r,
                  o = [];
                if (0 === this._eventsCount) return o;
                for (r in (e = this._events))
                  t.call(e, r) && o.push(n ? r.slice(1) : r);
                return Object.getOwnPropertySymbols
                  ? o.concat(Object.getOwnPropertySymbols(e))
                  : o;
              }),
              (c.prototype.listeners = function (e) {
                var t = this._events[n ? n + e : e];
                if (!t) return [];
                if (t.fn) return [t.fn];
                for (var r = 0, o = t.length, i = new Array(o); r < o; r++)
                  i[r] = t[r].fn;
                return i;
              }),
              (c.prototype.listenerCount = function (e) {
                var t = this._events[n ? n + e : e];
                return t ? (t.fn ? 1 : t.length) : 0;
              }),
              (c.prototype.emit = function (e, t, r, o, i, s) {
                var c = n ? n + e : e;
                if (!this._events[c]) return !1;
                var u,
                  a,
                  l = this._events[c],
                  f = arguments.length;
                if (l.fn) {
                  switch (
                    (l.once && this.removeListener(e, l.fn, void 0, !0), f)
                  ) {
                    case 1:
                      return (l.fn.call(l.context), !0);
                    case 2:
                      return (l.fn.call(l.context, t), !0);
                    case 3:
                      return (l.fn.call(l.context, t, r), !0);
                    case 4:
                      return (l.fn.call(l.context, t, r, o), !0);
                    case 5:
                      return (l.fn.call(l.context, t, r, o, i), !0);
                    case 6:
                      return (l.fn.call(l.context, t, r, o, i, s), !0);
                  }
                  for (a = 1, u = new Array(f - 1); a < f; a++)
                    u[a - 1] = arguments[a];
                  l.fn.apply(l.context, u);
                } else {
                  var d,
                    p = l.length;
                  for (a = 0; a < p; a++)
                    switch (
                      (l[a].once && this.removeListener(e, l[a].fn, void 0, !0),
                      f)
                    ) {
                      case 1:
                        l[a].fn.call(l[a].context);
                        break;
                      case 2:
                        l[a].fn.call(l[a].context, t);
                        break;
                      case 3:
                        l[a].fn.call(l[a].context, t, r);
                        break;
                      case 4:
                        l[a].fn.call(l[a].context, t, r, o);
                        break;
                      default:
                        if (!u)
                          for (d = 1, u = new Array(f - 1); d < f; d++)
                            u[d - 1] = arguments[d];
                        l[a].fn.apply(l[a].context, u);
                    }
                }
                return !0;
              }),
              (c.prototype.on = function (e, t, n) {
                return i(this, e, t, n, !1);
              }),
              (c.prototype.once = function (e, t, n) {
                return i(this, e, t, n, !0);
              }),
              (c.prototype.removeListener = function (e, t, r, o) {
                var i = n ? n + e : e;
                if (!this._events[i]) return this;
                if (!t) return (s(this, i), this);
                var c = this._events[i];
                if (c.fn)
                  c.fn !== t ||
                    (o && !c.once) ||
                    (r && c.context !== r) ||
                    s(this, i);
                else {
                  for (var u = 0, a = [], l = c.length; u < l; u++)
                    (c[u].fn !== t ||
                      (o && !c[u].once) ||
                      (r && c[u].context !== r)) &&
                      a.push(c[u]);
                  a.length
                    ? (this._events[i] = 1 === a.length ? a[0] : a)
                    : s(this, i);
                }
                return this;
              }),
              (c.prototype.removeAllListeners = function (e) {
                var t;
                return (
                  e
                    ? this._events[(t = n ? n + e : e)] && s(this, t)
                    : ((this._events = new r()), (this._eventsCount = 0)),
                  this
                );
              }),
              (c.prototype.off = c.prototype.removeListener),
              (c.prototype.addListener = c.prototype.on),
              (c.prefixed = n),
              (c.EventEmitter = c),
              (e.exports = c));
          })(W)),
        W.exports);
    const q = D($),
      I = s.createContext(new q());
    function F() {
      return s.useContext(I);
    }
    function V({ children: e }) {
      const t = s.useMemo(() => new q(), []);
      return n.jsx(I.Provider, { value: t, children: e });
    }
    const J = s.createContext(new Map());
    function K() {
      return s.useContext(J);
    }
    function Q() {
      const [, e] = s.useReducer((e) => e + 1, 0);
      return e;
    }
    function X({ action: e, renderer: n }) {
      const r = F(),
        o = K(),
        i = Q(),
        c = s.useMemo(() => {
          const t = o.get(e);
          if (t) return t;
          const n = { state: new B(), listeners: new Set() };
          return (o.set(e, n), n);
        }, [e, o]);
      s.useLayoutEffect(() => {
        function t(e) {
          (c.state.hydrate({ value: e }), c.listeners.forEach((e) => e()));
        }
        return (
          c.listeners.add(i),
          r.on(e, t),
          () => {
            (c.listeners.delete(i), r.off(e, t));
          }
        );
      }, [e, r, c]);
      const u = c.state.model?.value;
      return t.G.isNullable(u)
        ? null
        : n({ value: u, inspect: c.state.inspect.value });
    }
    function Y({ children: e }) {
      const t = s.useMemo(() => new Map(), []);
      return n.jsx(J.Provider, { value: t, children: e });
    }
    const Z = s.createContext(new Set());
    function ee({ children: e }) {
      const t = s.useMemo(() => new Set(), []);
      return n.jsx(Z.Provider, { value: t, children: e });
    }
    ((e.Action = (e, t = u.Unicast) => {
      const n =
          t === u.Broadcast
            ? Symbol(`${m.distributedActionPrefix}${e}`)
            : Symbol(`${m.actionPrefix}${e}`),
        r = function (e) {
          return { [d]: n, [l]: void 0, [p]: e, channel: e };
        };
      return (
        Object.defineProperty(r, d, { value: n, enumerable: !1 }),
        Object.defineProperty(r, l, { value: void 0, enumerable: !1 }),
        t === u.Broadcast &&
          Object.defineProperty(r, f, { value: !0, enumerable: !1 }),
        r
      );
    }),
      (e.Boundary = function ({ children: e }) {
        return n.jsx(V, {
          children: n.jsx(Y, { children: n.jsx(ee, { children: e }) }),
        });
      }),
      (e.Distribution = u),
      (e.Error = function ({ handler: e, children: t }) {
        return n.jsx(P.Provider, { value: e, children: t });
      }),
      (e.Lifecycle = c),
      (e.Op = _),
      (e.Operation = _),
      (e.Reason = h),
      (e.State = B),
      (e.With = function (e) {
        return (t, n) => {
          t.actions.produce((t) => {
            t.model[e] = n;
          });
        };
      }),
      (e.useActions = function (e, n = () => ({})) {
        const o = F(),
          i = r.useContext(P),
          u = s.useContext(Z),
          [l, f] = s.useState(e),
          d = Q(),
          p = s.useRef(null),
          h = s.useRef(
            (() => {
              const t = new B();
              return ((p.current = t.hydrate(e)), t);
            })(),
          ),
          y = (function (e) {
            const t = s.useRef(e);
            return (
              s.useLayoutEffect(() => {
                t.current = e;
              }, [e]),
              s.useMemo(() => {
                return (
                  (n = t),
                  Object.keys(e).reduce(
                    (e, t) => (
                      Object.defineProperty(e, t, {
                        get: () => n.current[t],
                        enumerable: !0,
                      }),
                      e
                    ),
                    {},
                  )
                );
                var n;
              }, [e])
            );
          })(n()),
          m = s.useMemo(() => new q(), []),
          b = s.useRef({ handlers: new Map() }),
          v = s.useRef(new Set()),
          g = s.useRef(a.Mounting),
          A = s.useCallback(
            (e, t, n) => {
              const r = new AbortController(),
                i = { controller: r, action: e, payload: t };
              return (
                u.add(i),
                {
                  model: l,
                  get phase() {
                    return g.current;
                  },
                  task: i,
                  data: y,
                  tasks: u,
                  actions: {
                    produce(e) {
                      if (r.signal.aborted) return;
                      const t = h.current.produce((t) =>
                        e({ model: t, inspect: h.current.inspect }),
                      );
                      (f(h.current.model),
                        n.processes.add(t),
                        p.current &&
                          (n.processes.add(p.current), (p.current = null)));
                    },
                    dispatch(e, t) {
                      if (r.signal.aborted) return;
                      const n = w(e),
                        i = E(e) ? e.channel : void 0;
                      (x(e) ? o : m).emit(n, t, i);
                    },
                    annotate: (e, t) => h.current.annotate(e, t),
                  },
                }
              );
            },
            [l],
          );
        (s.useLayoutEffect(() => {
          function e(e, n, r) {
            return async function (o, s) {
              const a = r();
              if (
                t.G.isNotNullable(s) &&
                t.G.isNotNullable(a) &&
                !(function (e, t) {
                  for (const n of Object.keys(e)) if (t[n] !== e[n]) return !1;
                  return !0;
                })(s, a)
              )
                return;
              const l = { processes: new Set() },
                f = Promise.withResolvers(),
                p = A(e, o, l);
              try {
                await n(p, o);
              } catch (y) {
                const t = b.current.handlers.has(c.Error),
                  n = { reason: O(y), error: S(y), action: j(e), handled: t };
                (i?.(n), t && m.emit(c.Error, n));
              } finally {
                for (const e of u)
                  if (e === p.task) {
                    u.delete(e);
                    break;
                  }
                (l.processes.forEach((e) => h.current.prune(e)),
                  d(),
                  f.resolve());
              }
            };
          }
          b.current.handlers.forEach((t, n) => {
            for (const { getChannel: r, handler: i } of t) {
              const t = e(n, i, r);
              x(n) ? (o.on(n, t), m.on(n, t), v.current.add(n)) : m.on(n, t);
            }
          });
        }, [m]),
          (function ({ unicast: e, distributedActions: n, phase: r, data: o }) {
            const i = K(),
              u = s.useRef(null);
            (s.useLayoutEffect(
              () => (
                e.emit(c.Mount),
                n.forEach((n) => {
                  const r = i.get(n),
                    o = r?.state.model?.value;
                  t.G.isNullable(o) || e.emit(n, o);
                }),
                (r.current = a.Mounted),
                () => {
                  ((r.current = a.Unmounting),
                    e.emit(c.Unmount),
                    (r.current = a.Unmounted));
                }
              ),
              [],
            ),
              s.useEffect(() => {
                e.emit(c.Node);
              }, []),
              s.useLayoutEffect(() => {
                if (t.G.isNotNullable(u.current)) {
                  const n = (function (e, t) {
                    return Object.keys(t).reduce(
                      (n, r) => (e[r] !== t[r] ? { ...n, [r]: t[r] } : n),
                      {},
                    );
                  })(u.current, o);
                  t.A.isNotEmpty(Object.keys(n)) && e.emit(c.Update, n);
                }
                u.current = o;
              }, [o, e]));
          })({
            unicast: m,
            distributedActions: v.current,
            phase: g,
            data: n(),
          }));
        const _ = s.useMemo(
          () => [
            l,
            {
              dispatch(e, t) {
                const n = w(e),
                  r = E(e) ? e.channel : void 0;
                (x(e) ? o : m).emit(n, t, r);
              },
              consume: (e, t) =>
                s.createElement(X, { action: w(e), renderer: t }),
              get inspect() {
                return h.current.inspect;
              },
            },
          ],
          [l, m],
        );
        return (
          (_.useAction = (e, t) => {
            !(function (e, t, n) {
              const r = s.useEffectEvent(async (e, t) => {
                  if (
                    "GeneratorFunction" === n.constructor.name ||
                    "AsyncGeneratorFunction" === n.constructor.name
                  ) {
                    const r = n(e, t);
                    for await (const e of r);
                  } else await n(e, t);
                }),
                o = s.useEffectEvent(() => (E(t) ? t.channel : void 0)),
                i = w(t),
                c = e.current.handlers.get(i) ?? new Set();
              (0 === c.size && e.current.handlers.set(i, c),
                c.add({ getChannel: o, handler: r }));
            })(b, e, t);
          }),
          _
        );
      }),
      (e.utils = g),
      Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }));
  }),
  "object" == typeof exports && "undefined" != typeof module
    ? factory(
        exports,
        require("@mobily/ts-belt"),
        require("react/jsx-runtime"),
        require("react"),
        require("immer"),
      )
    : "function" == typeof define && define.amd
      ? define(
          ["exports", "@mobily/ts-belt", "react/jsx-runtime", "react", "immer"],
          factory,
        )
      : factory(
          ((global =
            "undefined" != typeof globalThis
              ? globalThis
              : global || self).Chizu = {}),
          global.TsBelt,
          global.jsxRuntime,
          global.React,
          global.Immer,
        ));
