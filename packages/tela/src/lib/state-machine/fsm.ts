export type BaseState = string | symbol;

export type BaseAction = string;

export type BaseStates<State extends BaseState = BaseState> = Record<State, BaseActions>;

type Args = any[];

type LifecycleAction = (arg: {
  from: BaseState | null;
  to: BaseState;
  event: BaseAction | null;
  args: Args;
}) => void;

type AllArgsAction = (...args: Args) => BaseState;

type VoidFunction = (...args: Args) => void;

type ActionFunction = BaseState | AllArgsAction | VoidFunction;

export type BaseActions = {
  _enter?: LifecycleAction;
  _exit?: LifecycleAction;
  [key: BaseAction]: ActionFunction;
};

type DetectFallBackState<State extends BaseState> = State extends "*" ? string : State;

type ExtractStates<States extends BaseStates> = DetectFallBackState<Exclude<keyof States, number>>;

type ExtractObjectValues<Object> = Object[keyof Object];

type GetActionFunctionMapping<Actions extends BaseActions> = {
  [Key in Exclude<keyof Actions, "_enter" | "_exit">]: Actions[Key] extends BaseState
    ? () => Actions[Key] extends void ? BaseState : Actions[Key]
    : Actions[Key] extends VoidFunction
    ? (...args: Parameters<Actions[Key]>) => BaseState
    : Actions[Key];
};

type GetActionMapping<States extends BaseStates> = ExtractObjectValues<{
  [Key in keyof States]: GetActionFunctionMapping<States[Key]>;
}>;

type ExtractActions<States extends BaseStates> = GetActionMapping<States>;

type Unsubscribe = () => void;

type Subscribe<S extends BaseState> = (callback: (state: S) => void) => Unsubscribe;

export type StateMachine<State extends BaseState, Actions> = {
  [Key in keyof Actions]: Actions[Key] | AllArgsAction;
} & {
  subscribe: Subscribe<State>;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

declare const svelteFsm: <Sts extends Readonly<BaseStates>, S extends ExtractStates<Sts>>(
  state: S,
  states: Sts
) => StateMachine<ExtractStates<Sts>, UnionToIntersection<ExtractActions<Sts>>>;

// export type svelteFsm;
// export default {
//   svelteFsm,
//   fsm
// };

export default function (state, states = {}) {
  /*
   * Core Finite State Machine functionality
   * - adheres to Svelte store contract (https://svelte.dev/docs#Store_contract)
   * - invoked events are dispatched to handler of current state
   * - transitions to returned state (or value if static property)
   * - calls _exit() and _enter() methods if they are defined on exited/entered state
   */
  const subscribers = new Set();
  let proxy;

  function subscribe(callback) {
    if (!(callback instanceof Function)) {
      throw new TypeError("callback is not a function");
    }
    subscribers.add(callback);
    callback(state);
    return () => subscribers.delete(callback);
  }

  function transition(newState, event, args) {
    const metadata = { from: state, to: newState, event, args };
    dispatch("_exit", metadata);
    state = newState;
    subscribers.forEach((callback) => callback(state));
    dispatch("_enter", metadata);
  }

  function dispatch(event, ...args) {
    const action = states[state]?.[event] ?? states["*"]?.[event];
    return action instanceof Function ? action.apply(proxy, args) : action;
  }

  function invoke(event, ...args) {
    const newState = dispatch(event, ...args)?.valueOf();
    if (["string", "symbol"].includes(typeof newState) && newState !== state) {
      transition(newState, event, args);
    }
    return state;
  }

  /*
   * Debounce functionality
   * - `debounce` is lazily bound to dynamic event invoker methods (see Proxy section below)
   * - `event.debounce(wait, ...args)` calls event with args after wait (unless called again first)
   * - cancels all prior invocations made for the same event
   * - cancels entirely when called with `wait` of `null`
   */
  const timeout = {};

  async function debounce(event, wait = 100, ...args) {
    clearTimeout(timeout[event]);
    if (wait === null) {
      return state;
    } else {
      await new Promise((resolve) => (timeout[event] = setTimeout(resolve, wait)));
      delete timeout[event];
      return invoke(event, ...args);
    }
  }

  /*
   * Proxy-based event invocation API:
   * - return a proxy object with single native subscribe method
   * - all other properties act as dynamic event invocation methods
   * - event invokers also respond to .debounce(wait, ...args) (see above)
   */
  proxy = new Proxy(
    { subscribe },
    {
      get(target, property) {
        if (!Reflect.has(target, property)) {
          target[property] = invoke.bind(null, property);
          target[property].debounce = debounce.bind(null, property);
        }
        return Reflect.get(target, property);
      }
    }
  );

  /*
   * `_enter` initial state and return the proxy object
   */
  dispatch("_enter", { from: null, to: state, event: null, args: [] });
  return proxy;
}
