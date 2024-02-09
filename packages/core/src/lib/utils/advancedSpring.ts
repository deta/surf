/**
 * This file contains a modified version of svelte's default spring function.
 * It adds:
 *   - inertia store
 *   - min, max bounds
 *   - settled (store, changing when spring has settled)
 *
 * lg, maxu.
 */
import { writable, type Readable, type Updater } from 'svelte/store'
import { tweened } from 'svelte/motion'
import { loop, now } from 'svelte/internal'
import { onDestroy } from 'svelte'
import type { Spring, SpringOpts, SpringUpdateOpts } from 'svelte/motion'

// ==== INLINED DEPS
/**
 * @param {any} obj
 * @returns {boolean}
 */
export function is_date(obj) {
  return Object.prototype.toString.call(obj) === '[object Date]'
}

/**
 * @template T
 * @param {import('./private.js').TickContext<T>} ctx
 * @param {T} last_value
 * @param {T} current_value
 * @param {T} target_value
 * @returns {T}
 */
function tick_spring(ctx, last_value, current_value, target_value) {
  if (typeof current_value === 'number' || is_date(current_value)) {
    // @ts-ignore
    const delta = target_value - current_value
    // @ts-ignore
    const velocity = (current_value - last_value) / (ctx.dt || 1 / 60) // guard div by 0
    const spring = ctx.opts.stiffness * delta
    const damper = ctx.opts.damping * velocity
    const acceleration = (spring - damper) * ctx.inv_mass
    const d = (velocity + acceleration) * ctx.dt
    if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
      return target_value // settled
    } else {
      ctx.settled = false // signal loop to keep ticking
      // @ts-ignore
      return is_date(current_value) ? new Date(current_value.getTime() + d) : current_value + d
    }
  } else if (Array.isArray(current_value)) {
    // @ts-ignore
    return current_value.map((_, i) =>
      tick_spring(ctx, last_value[i], current_value[i], target_value[i])
    )
  } else if (typeof current_value === 'object') {
    const next_value = {}
    for (const k in current_value) {
      // @ts-ignore
      next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k])
    }
    // @ts-ignore
    return next_value
  } else {
    throw new Error(`Cannot spring ${typeof current_value} values`)
  }
}

export interface AdvancedSpring<T> extends Readable<T> {
  set: (new_value: T, opts?: SpringUpdateOpts) => Promise<void>
  update: (fn: Updater<T>, opts?: SpringUpdateOpts) => Promise<void>
  precision: number
  damping: number
  stiffness: number
}
export interface AdvancedSpringOpts {
  stiffness?: number
  damping?: number
  precision?: number
  min?: number
  max?: number
}
/**
 * Extended default spring function, adding inertia, min, max, and settled.
 *
 * https://svelte.dev/docs/svelte-motion#spring
 * @template [T=any]
 * @param {T} [value]
 * @param {AdvancedSpringOpts} [opts]
 * @returns {AdvancedSpring<T>}
 */
export function advancedSpring<T extends number>(value: T, opts: AdvancedSpringOpts = {}) {
  const store = writable(value)
  const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts
  // HACK: we need to update defaults in opts, as they can be updated from outside accessing opts
  if (opts.min === undefined) opts.min = -Infinity
  if (opts.max === undefined) opts.max = Infinity

  let last_time: number
  let task: any
  let current_token: object
  let last_value: T = value
  let target_value: T = value
  let inv_mass = 1
  let inv_mass_recovery_rate = 0
  let cancel_task = false
  let settled = writable(true)
  //let inertia = writable(0);
  let inertia = tweened(0, { duration: 40 })

  onDestroy(
    store.subscribe((v) => {
      if (v > opts.max!) set(opts.max!, { soft: 0.04 })
      if (v < opts.min!) set(opts.min!, { soft: 0.04 })
    })
  )

  /**
   * @param {T extends number} new_value
   * @param {import('./private.js').SpringUpdateOpts} opts
   * @returns {Promise<void>}
   */
  function set(new_value: T, opts = {}) {
    target_value = new_value
    const token = (current_token = {})
    if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
      cancel_task = true // cancel any running animation
      last_time = now()
      last_value = new_value
      store.set((value = target_value))
      return Promise.resolve()
    } else if (opts.soft) {
      const rate = opts.soft === true ? 0.5 : +opts.soft
      inv_mass_recovery_rate = 1 / (rate * 60)
      inv_mass = 0 // infinite mass, unaffected by spring forces
    }
    if (!task) {
      settled.set(false)
      last_time = now()
      cancel_task = false
      task = loop((now) => {
        if (cancel_task) {
          cancel_task = false
          task = null
          return false
        }
        inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1)
        const ctx = {
          inv_mass,
          opts: spring,
          settled: true,
          dt: ((now - last_time) * 60) / 1000
        }
        const next_value = tick_spring(ctx, last_value, value, target_value)
        const _inertia = (next_value - last_value) / ctx.dt
        inertia.set(isNaN(_inertia) ? 0 : _inertia)
        last_time = now
        last_value = value
        store.set((value = next_value))
        if (ctx.settled) {
          settled.set(true)
          task = null
        }
        return !ctx.settled
      })
    }
    return new Promise((fulfil) => {
      task.promise.then(() => {
        settled.set(true)
        if (token === current_token) {
          fulfil()
        }
      })
    })
  }
  /** @type {import('./public.js').Spring<T>} */
  const spring = {
    set,
    update: (fn, opts = {}) => set(fn(target_value, value), opts),
    subscribe: store.subscribe,
    stiffness,
    damping,
    precision,
    opts,
    settled,
    inertia
  }
  return spring
}
