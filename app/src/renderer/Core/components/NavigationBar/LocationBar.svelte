<script lang="ts">
  // https://www.electronjs.org/docs/latest/api/web-contents
  import { useBrowser } from '@deta/services/browser'
  import {
    useViewManager,
    ViewManagerEmitterNames,
    WebContents,
    WebContentsEmitterNames,
    WebContentsView,
    WebContentsViewEmitterNames
  } from '@deta/services/views'
  import {
    clickOutside,
    isInternalRendererURL,
    parseStringIntoBrowserLocation,
    truncate,
    useDebounce,
    useLogScope
  } from '@deta/utils'
  import Breadcrumb from './Breadcrumb.svelte'
  import { writable } from 'svelte/store'
  import { RisoText, RisoTextController } from '@deta/ui'
  import { cubicOut, expoOut } from 'svelte/easing'
  import { Tween } from 'svelte/motion'
  import { onMount, tick } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import { type Fn, ViewType } from '@deta/types'

  let {
    view,
    readonly = false,
    isEditingUrl = $bindable(false)
  }: {
    view: WebContentsView
    readonly?: boolean
    isEditingUrl?: boolean
  } = $props()

  const log = useLogScope('LocationBar')
  const browser = useBrowser()
  const viewManager = useViewManager()

  const viewTitle = $derived(view.title)
  const viewTypeData = $derived(view.typeData)
  const viewLocation = $derived(view.url ?? writable(''))
  const viewURL = $derived($viewLocation !== '' ? new URL($viewLocation) : null)
  const isActiveLocationInternalRenderer = $derived(isInternalRendererURL(viewURL))
  const activeHostname = $derived(viewURL ? viewURL.host : null)
  const hostnameText = $derived(
    !isActiveLocationInternalRenderer ? truncate(activeHostname, 36) : null
  )

  const titleText = $derived.by(() => {
    if ($viewTypeData.type === ViewType.Page) {
      return truncate($viewTitle.length > 0 ? `/ ${$viewTitle}` : '', 69)
    }

    if ($viewTypeData.type === ViewType.Notebook || $viewTypeData.type === ViewType.NotebookHome) {
      if ($viewTitle.startsWith('surf://')) {
        return $viewTypeData.type === ViewType.NotebookHome ? 'Surf' : 'Notebook'
      }

      return truncate($viewTitle, 69)
    }

    if ($viewTypeData.type === ViewType.Resource) {
      if ($viewTypeData.raw) {
        if (!isActiveLocationInternalRenderer) {
          return 'Resource'
        }

        if (isActiveLocationInternalRenderer.href.startsWith('surf://')) {
          return 'Resource'
        }

        return truncate(isActiveLocationInternalRenderer.href, 69)
      }

      if ($viewTitle.startsWith('surf://')) {
        return 'Resource'
      }

      return truncate($viewTitle, 69)
    }

    return truncate($viewTitle, 69)
  })

  // Input editing
  let inputEl = $state() as HTMLInputElement
  let inputValue: string = $derived(sanitizeLocationInput($viewLocation))

  const hostnameTextController = new RisoTextController({
    rasterDensity: {
      start: 5,
      duration: 400,
      delay: 0,
      easing: cubicOut
    },
    rasterFill: {
      start: 0.4,
      duration: 700,
      delay: 0,
      easing: cubicOut
    },
    textBleed: {
      start: 0.4,
      duration: 450,
      delay: 0,
      easing: cubicOut
    }
  })

  // View Tracking
  interface ViewState {
    isLoading: boolean
    loadingProgress: Tween<number>
    textController: RisoTextController
    unsubs: Fn[]
    flowTimers: NodeJS.Timeout[]
  }
  const viewStates = new SvelteMap<string, ViewState>()
  const activeViewState = $derived(viewStates.get(view.id))

  function sanitizeLocationInput(value: string): string {
    if (isInternalRendererURL(value)) {
      const url = isInternalRendererURL(value)
      return url.toString().replace(/\/+$/, '')
    }
    return value
  }

  function handleLocationInput(e: InputEvent) {
    e.preventDefault()
    inputValue = sanitizeLocationInput((e.target as HTMLInputElement).value)
  }

  function handleSubmit() {
    const raw = inputEl?.value.trim()

    const url = parseStringIntoBrowserLocation(raw)
    if (url) {
      view.webContents.loadURL(url, true)
      return
    }

    const searchUrl = browser.getSearchUrl(raw)
    view.webContents.loadURL(searchUrl, true)
  }

  function handleWCVStartLoading(view: WebContentsView) {
    //log.debug('View started loading', view.id)
    const state = viewStates.get(view.id)
    if (!state) throw new Error('View loading without state!')
    if (state.isLoading) {
      log.debug('! Skipping loading start -> view already loading', view.id)
      return
    }
    state.isLoading = true

    state.flowTimers.forEach((e) => {
      clearTimeout(e)
      clearInterval(e)
    })
    state.flowTimers.length = 0

    state.textController.reset()
    state.loadingProgress.set(0, { duration: 0 })

    state.flowTimers.push(
      setTimeout(() => {
        state.textController.t_rasterDensity.target = 1.55
        state.textController.t_rasterFill.target = 0.45
      }, 75),
      setTimeout(() => {
        state.loadingProgress.target = 0.35
      }, 400),
      setTimeout(() => {
        state.loadingProgress.target = 0.55
      }, 1000),
      setTimeout(() => {
        const interval = setInterval(() => {
          // Exponential decay
          state.loadingProgress.target += (1 - state.loadingProgress.target) * 0.04
          if (state.loadingProgress.target > 0.98) {
            clearInterval(interval)
          }
        }, 20)
        state.flowTimers.push(interval)
      }, 1300)
    )
  }
  function handleWCVStopLoading(view: WebContentsView) {
    //log.debug('View stopped loading', view.id)
    const state = viewStates.get(view.id)
    if (!state) throw new Error('View loading without state!')
    if (!state.isLoading) {
      log.debug('! Skipping loading stop -> view not loading', view.id)
      return
    }

    state.flowTimers.forEach((e) => {
      clearTimeout(e)
      clearInterval(e)
    })
    state.flowTimers.length = 0
    state.loadingProgress.target = 1

    // experiment with this maybe
    //state.flowTimers.push(
    //  setTimeout(() => {
    //    state.textController.t_textBleed.target = 0
    //    // state.textController.t_rasterDensity.target = 1.55
    //    // state.textController.t_rasterFill.target = 0.45

    //  }, 200)
    //)
    state.textController.t_textBleed.target = 0
    state.textController.t_rasterDensity.target = 1.55
    //state.textController.t_rasterFill.target = 0.45
    state.textController.t_rasterFill.target = 0.6

    state.isLoading = false
  }

  const handleDidNavigate = useDebounce((view) => {
    handleWCVStopLoading(view)
  }, 100)

  function handleViewChanged(view: WebContentsView) {
    if (viewStates.has(view.id)) return
    log.debug('Tracking new viewState ', view.id)

    if (!view.webContents) return // throw new Error('Cannot track view withotu webContents in LocationBar!')

    const unsubs = [
      view.on(WebContentsViewEmitterNames.MOUNTED, (webContents: WebContents) => {
        //log.debug(view.id + ' | View mounted')
        handleWCVStartLoading(webContents.view)
      }),
      //view.webContents?.on(WebContentsEmitterNames.DID_START_LOADING, () =>
      //  log.debug(view.id + ' | Loading')
      //),
      //view.webContents?.on(WebContentsEmitterNames.DID_START_LOADING, () =>
      //  log.debug(view.id + ' | DONE Loading')
      //),
      view.webContents?.on(WebContentsEmitterNames.WILL_NAVIGATE, () => {
        //log.debug(view.id + ' | will navigate')
        handleWCVStartLoading(view)
      }),
      view.webContents?.on(WebContentsEmitterNames.DID_NAVIGATE, async () => {
        //log.debug(view.id + ' | DID navigate')
        //handleDidNavigate(view)
        handleWCVStartLoading(view)
      }),
      view.webContents?.on(WebContentsEmitterNames.DOM_READY, async () => {
        //log.debug(view.id + ' | DOM READY')
        handleDidNavigate(view)
      })
      // TODO: (maxu): figure out in page navigation
      //view.webContents?.on(WebContentsEmitterNames.DID_NAVIGATE_IN_PAGE, async () => {
      //  log.debug(view.id + ' | DID navigate in page')
      //  handleWCVStartLoading(view)
      //})
    ]

    viewStates.set(view.id, {
      isLoading: false,
      loadingProgress: new Tween(1, { duration: 500, easing: expoOut }),
      textController: new RisoTextController({
        rasterDensity: {
          //start: 10,
          start: 2,
          duration: 900, // 600
          delay: 0,
          easing: cubicOut
        },
        rasterFill: {
          start: 0.65,
          duration: 350,
          delay: 0,
          easing: cubicOut
        },
        textBleed: {
          //start: 0.54,
          start: 0.4,
          duration: 175,
          delay: 0,
          easing: expoOut
        }
      }),
      unsubs,
      flowTimers: []
    })

    handleWCVStartLoading(view)
  }

  $effect(() => {
    // Autofocus and select when editing
    if (isEditingUrl) {
      tick().then(() => {
        inputEl?.select()
        inputEl?.focus()
      })
    }

    // Reset when exiting editing state
    else {
      inputValue = sanitizeLocationInput($viewLocation)
    }
  })

  // This animates the hostname everytime it changes
  $effect(() => {
    if (hostnameText) {
      hostnameTextController.reset()
      hostnameTextController.t_rasterDensity.target = 1.75
      hostnameTextController.t_rasterFill.target = 0.7
      hostnameTextController.t_textBleed.target = 0.25
    }
  })
  //$effect(() => handleViewChanged(view))

  onMount(() => {
    const unsubs = [
      viewManager.on(ViewManagerEmitterNames.CREATED, (view: WebContents) => {
        handleViewChanged(view.view)
      }),
      viewManager.on(ViewManagerEmitterNames.DELETED, (viewId: string) => {
        log.debug('Deleting viewState ', viewId)
        viewStates.get(viewId)?.unsubs?.forEach((f) => f())
        viewStates.get(viewId)?.flowTimers?.forEach((e) => {
          clearTimeout(e)
          clearInterval(e)
        })
        viewStates.delete(viewId)
      })
    ]
    return () => {
      viewStates.values().forEach((state) => {
        state.unsubs.forEach((f) => f())
        state.flowTimers.forEach((e) => {
          clearTimeout(e)
          clearInterval(e)
        })
      })
      viewStates.clear()
      unsubs.forEach((f) => f())
    }
  })
</script>

<Breadcrumb
  active={isEditingUrl}
  class="location-bar"
  disabled={readonly}
  onclick={() => {
    if (readonly) return
    isEditingUrl = true
  }}
>
  {#if isEditingUrl}
    <input
      bind:this={inputEl}
      type="text"
      value={inputValue}
      oninput={handleLocationInput}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          isEditingUrl = false
          handleSubmit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          isEditingUrl = false
        } else {
          e.stopPropagation()
        }
      }}
      {@attach clickOutside(() => (isEditingUrl = false))}
    />
  {:else}
    {#if hostnameText}
      <div class="hostname">
        <span style="opacity: 0;">{hostnameText}</span>
        <RisoText
          text={hostnameText}
          incBleed={0.75}
          textBleed={0.25}
          rasterDensity={1.75}
          rasterFill={0.7}
          animationController={hostnameTextController}
        />
      </div>
    {/if}
    {#if titleText && activeViewState}
      <div
        class="title"
        style:--progress={`${activeViewState.loadingProgress.current * 100}%`}
        class:done={activeViewState.loadingProgress.current >= 1}
      >
        <span>{titleText}</span>
        <!--
          NOTE: This key is ensuring no weird inbetween states.. should work
                without but let's be sure!
        -->
        {#key activeViewState}
          <RisoText
            text={titleText}
            incBleed={1}
            textBleed={0.225}
            rasterDensity={1.55}
            rasterFill={0.45}
            animationController={activeViewState.textController}
          />
        {/key}
      </div>
    {/if}
  {/if}
</Breadcrumb>

<style lang="scss">
  :global(.location-bar) {
    width: 100%;
    flex: 1;
    flex-shrink: 1;
    font-family: 'Inter', sans-serif;
    min-width: 0;
  }

  .hostname,
  .title {
    position: relative;
    mix-blend-mode: darken;

    @media (prefers-color-scheme: dark) {
      mix-blend-mode: lighten;

      :global(svg.riso) {
        --riso-m: rgb(160 110 255) !important;
      }
    }

    span {
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.014rem;
      margin-bottom: 1.25px;
      -webkit-font-smoothing: antialiased;
      mask-image: linear-gradient(
        to right,
        transparent calc(var(--progress) + 0.05rem) #000 var(--progress)
      );
      white-space: nowrap;
    }

    :global(svg.riso) {
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.1rem;
      position: absolute;
      inset: 0;
      padding-top: 1.5px;
    }
  }

  .title {
    flex-shrink: 1;
    min-width: 0;
    display: flex;
    align-items: center;

    span {
      opacity: 0.1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    :global(svg.riso) {
      transition: opacity 187ms ease-out;
      opacity: 0.75;
      font-family: 'Inter', sans-serif;
      mask-image: linear-gradient(
        to right,
        light-dark(#000, #fff) var(--progress),
        transparent calc(var(--progress) + 0.05rem)
      );
    }

    &.done {
      span {
        opacity: 0.75;
        color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
      }
      :global(svg.riso) {
        opacity: 0;
      }
    }
  }
  input {
    width: 100%;
    outline: none !important;
    background: none;
  }
</style>
