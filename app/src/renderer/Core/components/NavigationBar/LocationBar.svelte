<script lang="ts">
  // suuper long loading page to test: https://www.rtty.com/CODECARD/codecrd1.htm
  import { tick } from "svelte";
  import { Tween } from "svelte/motion";
  import { cubicOut, expoOut } from "svelte/easing";
  import {
    clickOutside,
    isInternalRendererURL,
    truncate,
    useThrottle,
  } from "@deta/utils";
  import Breadcrumb from "./Breadcrumb.svelte";
  import { RisoText, RisoTextController } from "@deta/ui";
  import WebContentsView from "../WebContentsView.svelte";
  import {
    WebContentsEmitterNames,
    WebContentsViewEmitterNames,
  } from "@deta/services/dist/views/types.js";
  import { writable } from "svelte/store";

  let {
    view,
  }: {
    view: WebContentsView;
  } = $props();

  // TODO: This should be part of the WebContentsView itself returning a Readable<URL | null> directly
  const viewTitle = $derived(view.title);
  const viewLocation = $derived(view.url ?? writable(""));
  const viewURL = $derived(
    $viewLocation !== "" ? new URL($viewLocation) : null,
  );
  const activeHostname = $derived(viewURL ? viewURL.host : null);
  const isActiveLocationInternalRenderer = $derived(
    isInternalRendererURL(viewURL),
  );

  const hostnameText = $derived(
    !isActiveLocationInternalRenderer ? truncate(activeHostname, 69) : null,
  );
  const titleText = $derived(
    truncate(
      !isActiveLocationInternalRenderer
        ? $viewTitle.length > 0
          ? `/ ${$viewTitle}`
          : ""
        : $viewTitle,
      69,
    ),
  );
  const t_progress_title = new Tween(0, { duration: 500, easing: expoOut });

  const hostnameTextController = new RisoTextController({
    rasterDensity: {
      start: 5,
      duration: 400,
      delay: 0,
      easing: cubicOut,
    },
    rasterFill: {
      start: 0.4,
      duration: 700,
      delay: 0,
      easing: cubicOut,
    },
    textBleed: {
      start: 0.4,
      duration: 450,
      delay: 0,
      easing: cubicOut,
    },
  });
  const titleTextController = new RisoTextController({
    rasterDensity: {
      start: 10,
      duration: 900, // 600
      delay: 0,
      easing: cubicOut,
    },
    rasterFill: {
      start: 0.65,
      duration: 350,
      delay: 0,
      easing: cubicOut,
    },
    textBleed: {
      start: 0.54,
      duration: 175,
      delay: 0,
      easing: expoOut,
    },
  });

  let inputEl = $state() as HTMLInputElement;
  let editingUrl = $state(false);

  // This animates the hostname everytime it changes
  $effect(() => {
    if (hostnameText) {
      hostnameTextController.reset();
      hostnameTextController.t_rasterDensity.target = 1.75;
      hostnameTextController.t_rasterFill.target = 0.7;
      hostnameTextController.t_textBleed.target = 0.25;
    }
  });

  let unsubs = [];
  $effect(() => {
    unsubs.forEach((e) => e && e());
    unsubs = [];
    unsubs.push(
      view.on(WebContentsViewEmitterNames.MOUNTED, () => {
        debouncedHandleStartLoading();
      }),
      view.webContents?.on(WebContentsEmitterNames.DID_START_LOADING, () => {
        debouncedHandleStartLoading();
      }),
      view.webContents?.on(WebContentsEmitterNames.DID_STOP_LOADING, () => {
        flowTimers.forEach((e) => {
          clearTimeout(e);
          clearInterval(e);
        });
        t_progress_title.target = 1;
        flowTimers.push(
          setTimeout(() => {
            titleTextController.t_textBleed.target = 0;
          }, 100),
        );
      }),
    );
  });

  let flowTimers: NodeJS.Timeout[] = [];
  // FIX: Some pages cause weird double/triple loading events
  // i.e. https://www.ciid.dk/pop-up-schools
  // Use custom throttle but cancel timeout on every user navigation!
  // FIX: Switching tabs while loading, the loading animation should be stopped
  // TODO: (maxu): Make it nicer, by waiting a few millis after a navigation
  // for the title to change before starting the animation / going through with it
  const debouncedHandleStartLoading = useThrottle(handleStartLoading, 0);
  function handleStartLoading() {
    if (t_progress_title.current !== 1) return;
    titleTextController.reset();

    flowTimers.forEach((e) => {
      clearTimeout(e);
      clearInterval(e);
    });

    flowTimers.push(
      setTimeout(() => {
        titleTextController.t_rasterDensity.target = 1.55;
        titleTextController.t_rasterFill.target = 0.45;
      }, 75),
      setTimeout(() => {
        t_progress_title.target = 0.35;
      }, 400),
      setTimeout(() => {
        t_progress_title.target = 0.55;
      }, 1000),
      setTimeout(() => {
        const interval = setInterval(() => {
          // Exponential decay
          t_progress_title.target += (1 - t_progress_title.target) * 0.04;
          if (t_progress_title.target > 0.98) {
            clearInterval(interval);
          }
        }, 20);
        flowTimers.push(interval);
      }, 1300),
    );
    t_progress_title.set(0, { duration: 0 });
  }
</script>

<Breadcrumb
  active={editingUrl}
  class="location-bar"
  onclick={() => {
    editingUrl = true;
    tick().then(() => inputEl?.focus());
  }}
>
  {#if editingUrl}
    <input
      bind:this={inputEl}
      type="text"
      value={$viewLocation}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          editingUrl = false;
          view.webContents.loadURL(
            new URL(
              `${!inputEl?.value.includes("://") ? "https://" : ""}${inputEl?.value}`,
            ).toString(),
          );
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          editingUrl = false;
        } else {
          e.stopPropagation();
        }
      }}
      {@attach clickOutside(() => (editingUrl = false))}
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
    {#if titleText}
      <div
        class="title"
        style:--progress={`${t_progress_title.current * 100}%`}
      >
        <span style="opacity: 0.1;">{titleText}</span>
        <RisoText
          text={titleText}
          incBleed={1}
          textBleed={0.225}
          rasterDensity={1.55}
          rasterFill={0.45}
          animationController={titleTextController}
        />
      </div>
    {/if}
  {/if}
</Breadcrumb>

<style lang="scss">
  :global(.location-bar) {
    width: 100%;
    flex: 1;
  }

  .hostname,
  .title {
    position: relative;
    mix-blend-mode: darken;

    span {
      mask-image: linear-gradient(
        to right,
        transparent calc(var(--progress) + 0.05rem) #000 var(--progress)
      );
    }

    :global(svg.riso) {
      position: absolute;
      inset: 0;
      padding-top: 1.5px;
    }
  }
  .title {
    :global(svg.riso) {
      mask-image: linear-gradient(
        to right,
        #000 var(--progress),
        transparent calc(var(--progress) + 0.05rem)
      );
    }
  }
  input {
    width: 100%;
    outline: none !important;
    background: none;
  }
</style>
