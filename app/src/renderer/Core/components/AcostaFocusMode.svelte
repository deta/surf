<script lang="ts">
  import { onMount } from 'svelte'
  import { useAcostaFocus } from '@deta/services'
  import { useConfig } from '@deta/services'
  import { NSW_SUBJECTS } from '@deta/types'
  import { get } from 'svelte/store'

  const focus = useAcostaFocus()
  const config = useConfig()

  onMount(() => {
    const handleToggle = () => toggle()
    document.addEventListener('acosta-toggle-focus', handleToggle)
    return () => document.removeEventListener('acosta-toggle-focus', handleToggle)
  })

  let dialogOpen = $state(false)
  let subject = $state('')
  let task = $state('')
  let focusMinutes = $state(25)
  let breakMinutes = $state(5)
  let allowlistText = $state('')
  let starting = $state(false)

  const active = $derived(focus.state.active)
  const phase = $derived(focus.state.phase)
  const summary = $derived(focus.lastSummary)

  const subjects = $derived.by(() => {
    try {
      const settings = get(config.settings) as any
      const configured = settings?.acosta?.subjects as { name: string }[] | undefined
      return configured?.map((s) => s.name) ?? [...NSW_SUBJECTS]
    } catch {
      return [...NSW_SUBJECTS]
    }
  })

  const remainingLabel = $derived.by(() => {
    const total = focus.remainingSeconds
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })

  export function toggle() {
    if (active) {
      void focus.stop()
    } else {
      openDialog()
    }
  }

  export function openDialog() {
    try {
      const settings = get(config.settings) as any
      const defaults = settings?.acosta?.focus_defaults
      if (defaults) {
        focusMinutes = defaults.focusMinutes ?? 25
        breakMinutes = defaults.breakMinutes ?? 5
        if (!allowlistText) allowlistText = (defaults.allowlist ?? []).join('\n')
      }
      subject = subject || settings?.acosta?.todays_focus_subject || subjects[0] || 'English'
    } catch {
      // use current field values
    }
    dialogOpen = true
  }

  async function startSession(event: SubmitEvent) {
    event.preventDefault()
    if (starting) return
    starting = true
    try {
      await focus.start({
        subject,
        task: task.trim() || 'Study session',
        focusMinutes: Math.max(1, focusMinutes),
        breakMinutes: Math.max(1, breakMinutes),
        allowlist: allowlistText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      })
      dialogOpen = false
    } finally {
      starting = false
    }
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
  }
</script>

{#if active}
  <div class="focus-chip" class:break={phase === 'break'}>
    {#if phase === 'focus'}
      <span class="phase-dot"></span>
      <span class="time">{remainingLabel}</span>
      <span class="task" title={focus.state.config?.task}>{focus.state.config?.subject}</span>
    {:else}
      <span class="phase-dot break"></span>
      <span class="time">{remainingLabel}</span>
      <span class="task">Break — breathe in… and out</span>
    {/if}
    <button class="end-button" onclick={() => focus.stop()}>End</button>
  </div>
{/if}

{#if dialogOpen}
  <div
    class="focus-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) dialogOpen = false
    }}
  >
    <form class="focus-dialog" onsubmit={startSession}>
      <h2>Start a focus session</h2>

      <label>
        Subject
        <select bind:value={subject}>
          {#each subjects as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
      </label>

      <label>
        What are you working on?
        <input type="text" bind:value={task} placeholder="e.g. Essay draft for Module B" />
      </label>

      <div class="duration-row">
        <label>
          Focus (minutes)
          <input type="number" min="1" max="180" bind:value={focusMinutes} />
        </label>
        <label>
          Break (minutes)
          <input type="number" min="1" max="60" bind:value={breakMinutes} />
        </label>
      </div>

      <label>
        Allowed sites (one per line)
        <textarea
          rows="4"
          bind:value={allowlistText}
          placeholder={'e.g.\nkhanacademy.org\neducationstandards.nsw.edu.au'}
        ></textarea>
      </label>

      <p class="hint">
        While focusing, only these sites (plus Acosta) are reachable. Everything else shows a gentle
        reminder of your task.
      </p>

      <div class="dialog-actions">
        <button type="button" class="secondary" onclick={() => (dialogOpen = false)}>
          Cancel
        </button>
        <button type="submit" disabled={starting}>
          {starting ? 'Starting…' : 'Start focusing'}
        </button>
      </div>
    </form>
  </div>
{/if}

{#if summary}
  <div class="focus-overlay" role="presentation">
    <div class="focus-dialog summary">
      <h2>Nice work! 🎉</h2>
      <p class="summary-line">
        You focused on <strong>{summary.subject}</strong> — {summary.task}
      </p>
      <ul>
        <li><strong>{formatDuration(summary.focusedSeconds)}</strong> focused</li>
        <li><strong>{summary.pagesVisited}</strong> pages visited</li>
        <li><strong>{summary.notesTaken}</strong> notes taken</li>
        {#if summary.blockedAttempts > 0}
          <li><strong>{summary.blockedAttempts}</strong> distractions dodged</li>
        {/if}
      </ul>
      <div class="dialog-actions">
        <button type="button" onclick={() => focus.dismissSummary()}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .focus-chip {
    position: fixed;
    top: 8px;
    right: 16px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #0d1b2a;
    color: #f7f9fb;
    font-size: 12px;
    border: 1px solid rgba(247, 249, 251, 0.15);
    -webkit-app-region: no-drag;

    .phase-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00c2a8;

      &.break {
        background: #ffc857;
      }
    }

    .time {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .task {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.7;
    }

    .end-button {
      background: none;
      border: none;
      color: #00c2a8;
      cursor: pointer;
      font-size: 12px;
      padding: 0 2px;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .focus-overlay {
    position: fixed;
    inset: 0;
    z-index: 1001;
    background: rgba(13, 27, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .focus-dialog {
    background: #0d1b2a;
    color: #f7f9fb;
    border: 1px solid rgba(247, 249, 251, 0.12);
    border-radius: 16px;
    padding: 24px;
    width: 420px;
    max-width: calc(100vw - 48px);
    display: flex;
    flex-direction: column;
    gap: 12px;

    h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 700;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: rgba(247, 249, 251, 0.65);
    }

    input,
    select,
    textarea {
      background: #14263a;
      color: #f7f9fb;
      border: 1px solid rgba(247, 249, 251, 0.12);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      outline: none;

      &:focus {
        border-color: #00c2a8;
      }
    }

    .duration-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .hint {
      font-size: 11px;
      color: rgba(247, 249, 251, 0.4);
      margin: 0;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;

      button {
        background: #00c2a8;
        color: #0d1b2a;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;

        &:disabled {
          opacity: 0.5;
        }

        &.secondary {
          background: transparent;
          color: #f7f9fb;
          border: 1px solid rgba(247, 249, 251, 0.2);
        }
      }
    }

    &.summary {
      ul {
        margin: 0;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
      }

      .summary-line {
        margin: 0;
        font-size: 13px;
        color: rgba(247, 249, 251, 0.75);
      }
    }
  }
</style>
