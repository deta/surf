<script lang="ts">
  import type { FileKind } from 'human-filetypes'
  import Icon from './Icon.svelte'

  export let kind: FileKind | 'code'
  export let width: number | string = '100%'
  export let height: number | string = '100%'
</script>

{#if kind === 'image'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M15 8h.01" /><path
      d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"
    /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path
      d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"
    /></svg
  >
{:else if kind === 'document' || kind === 'text'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
      d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
    /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg
  >
{:else if kind === 'video'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
      d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"
    /><path d="M8 4l0 16" /><path d="M16 4l0 16" /><path d="M4 8l4 0" /><path d="M4 16l4 0" /><path
      d="M4 12l16 0"
    /><path d="M16 8l4 0" /><path d="M16 16l4 0" /></svg
  >
{:else if kind === 'audio'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
      d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"
    /><path d="M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v13" /><path
      d="M9 8h10"
    /></svg
  >
{:else if kind === 'archive'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
      d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"
    /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" /><path d="M10 12l4 0" /></svg
  >
{:else if kind === 'spreadsheet'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
      d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
    /><path d="M8 11h8v7h-8z" /><path d="M8 15h8" /><path d="M11 11v7" /></svg
  >
{:else if kind === 'presentation'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 4l18 0" /><path
      d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10"
    /><path d="M12 16l0 4" /><path d="M9 20l6 0" /><path d="M8 12l3 -3l2 2l3 -3" /></svg
  >
{:else if kind === 'font'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
      d="M17.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"
    /><path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5" /><path d="M3 13h7" /><path d="M21 12v7" /></svg
  >
{:else if kind === 'application'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
      d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
    /><path d="M10 13l-1 2l1 2" /><path d="M14 13l1 2l-1 2" /></svg
  >
{:else if kind === 'code'}
  <Icon name="code-block" size={width} />
{:else}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style="--width: {width}; --height: {height};"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
      d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
    /></svg
  >
{/if}

<style lang="scss">
  svg {
    width: var(--width);
    height: var(--height);
  }
</style>
