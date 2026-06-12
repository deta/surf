<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import {
    OPTIONAL_FILTER_CATEGORIES,
    FILTER_CATEGORY_LABELS,
    ACOSTA_MODELS,
    type AcostaSettings,
    type AcostaUser
  } from '@deta/types'
  import SettingsOption from './SettingsOption.svelte'

  const dispatch = createEventDispatcher<{ update: void }>()

  export let acosta: AcostaSettings

  let user: AcostaUser | null = null
  let blocklistText = ''
  let allowlistText = ''
  let focusAllowlistText = acosta.focus_defaults.allowlist.join('\n')
  let newSubject = ''

  $: blocklistText = acosta.content_filter.custom_blocklist.join('\n')
  $: allowlistText = acosta.content_filter.custom_allowlist.join('\n')

  onMount(async () => {
    try {
      const state = await window.api.acosta.getAuthState()
      if (state?.status === 'signed-in') user = state.user
    } catch {
      user = null
    }
  })

  const update = () => dispatch('update')

  const parseHostList = (text: string): string[] =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  function toggleCategory(category: (typeof OPTIONAL_FILTER_CATEGORIES)[number], enabled: boolean) {
    const current = new Set(acosta.content_filter.enabled_optional_categories)
    if (enabled) {
      current.add(category)
    } else {
      current.delete(category)
    }
    acosta.content_filter.enabled_optional_categories = [...current]
    update()
  }

  function addSubject() {
    const name = newSubject.trim()
    if (!name) return
    if (acosta.subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
      newSubject = ''
      return
    }
    acosta.subjects = [
      ...acosta.subjects,
      { id: name.toLowerCase().replace(/\s+/g, '-'), name, builtIn: false }
    ]
    newSubject = ''
    update()
  }

  function removeSubject(id: string) {
    acosta.subjects = acosta.subjects.filter((subject) => subject.id !== id || subject.builtIn)
    update()
  }

  async function signOut() {
    await window.api.acosta.signOut()
  }
</script>

<div class="acosta-settings">
  <section>
    <h2>Account</h2>
    {#if user}
      <div class="account-row">
        {#if user.photoURL}
          <img class="avatar" src={user.photoURL} alt="" referrerpolicy="no-referrer" />
        {:else}
          <div class="avatar placeholder">
            {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
          </div>
        {/if}
        <div class="account-details">
          <span class="name">{user.displayName ?? 'Student'}</span>
          <span class="email">{user.email}</span>
        </div>
        <button class="sign-out" on:click={signOut}>Sign out</button>
      </div>
    {:else}
      <p class="muted">Not signed in.</p>
    {/if}
  </section>

  <section>
    <h2>AI</h2>
    <label class="field">
      Default model
      <select bind:value={acosta.default_model} on:change={update}>
        {#each ACOSTA_MODELS as model}
          <option value={model.id}>{model.label}</option>
        {/each}
      </select>
    </label>
    <SettingsOption
      title="Auto-summarise pages"
      description="Generate a page summary in the sidebar automatically when a page loads."
      bind:value={acosta.auto_summarise_on_load}
      on:update={update}
    />
  </section>

  <section>
    <h2>Content filtering</h2>
    <p class="muted">
      Adult content, gambling, drugs and violence are always filtered and can't be turned off.
    </p>
    {#each OPTIONAL_FILTER_CATEGORIES as category}
      <SettingsOption
        title={`Block ${FILTER_CATEGORY_LABELS[category].toLowerCase()}`}
        description={category === 'social'
          ? 'Blocks social networks like TikTok, Instagram and Snapchat.'
          : 'Blocks gaming sites and storefronts.'}
        value={acosta.content_filter.enabled_optional_categories.includes(category)}
        on:update={(e) => toggleCategory(category, e.detail)}
      />
    {/each}

    <label class="field">
      Always block these sites (one per line)
      <textarea
        rows="3"
        value={blocklistText}
        on:change={(e) => {
          acosta.content_filter.custom_blocklist = parseHostList(e.currentTarget.value)
          update()
        }}
      ></textarea>
    </label>

    <label class="field">
      Always allow these sites (one per line)
      <textarea
        rows="3"
        value={allowlistText}
        on:change={(e) => {
          acosta.content_filter.custom_allowlist = parseHostList(e.currentTarget.value)
          update()
        }}
      ></textarea>
    </label>

    <label class="field">
      Teacher or parent email (for access requests)
      <input
        type="email"
        placeholder="teacher@school.nsw.edu.au"
        value={acosta.guardian_email ?? ''}
        on:change={(e) => {
          acosta.guardian_email = e.currentTarget.value.trim() || null
          update()
        }}
      />
    </label>
  </section>

  <section>
    <h2>Focus mode</h2>
    <div class="duration-row">
      <label class="field">
        Focus length (minutes)
        <input
          type="number"
          min="1"
          max="180"
          bind:value={acosta.focus_defaults.focusMinutes}
          on:change={update}
        />
      </label>
      <label class="field">
        Break length (minutes)
        <input
          type="number"
          min="1"
          max="60"
          bind:value={acosta.focus_defaults.breakMinutes}
          on:change={update}
        />
      </label>
    </div>
    <label class="field">
      Default allowed sites during focus (one per line)
      <textarea
        rows="3"
        value={focusAllowlistText}
        on:change={(e) => {
          acosta.focus_defaults.allowlist = parseHostList(e.currentTarget.value)
          update()
        }}
      ></textarea>
    </label>
  </section>

  <section>
    <h2>Study subjects</h2>
    <label class="field">
      Today's focus subject
      <select
        value={acosta.todays_focus_subject ?? ''}
        on:change={(e) => {
          acosta.todays_focus_subject = e.currentTarget.value || null
          update()
        }}
      >
        <option value="">None</option>
        {#each acosta.subjects as subject}
          <option value={subject.name}>{subject.name}</option>
        {/each}
      </select>
    </label>

    <ul class="subjects">
      {#each acosta.subjects as subject}
        <li>
          <span>{subject.name}</span>
          {#if !subject.builtIn}
            <button class="remove" on:click={() => removeSubject(subject.id)}>Remove</button>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="add-subject">
      <input
        type="text"
        placeholder="Add a custom subject"
        bind:value={newSubject}
        on:keydown={(e) => e.key === 'Enter' && addSubject()}
      />
      <button on:click={addSubject}>Add</button>
    </div>
  </section>
</div>

<style lang="scss">
  .acosta-settings {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;

    section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    h2 {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
    }

    .muted {
      font-size: 12px;
      opacity: 0.6;
      margin: 0;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      opacity: 0.9;

      input,
      select,
      textarea {
        font-size: 13px;
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px solid light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.15));
        background: light-dark(#fff, rgba(255, 255, 255, 0.06));
        color: inherit;
        outline: none;

        &:focus {
          border-color: #00c2a8;
        }
      }
    }

    .duration-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .account-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;

        &.placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #00c2a8;
          color: #0d1b2a;
          font-weight: 700;
        }
      }

      .account-details {
        display: flex;
        flex-direction: column;

        .name {
          font-weight: 600;
          font-size: 14px;
        }

        .email {
          font-size: 12px;
          opacity: 0.6;
        }
      }

      .sign-out {
        margin-left: auto;
        background: none;
        border: 1px solid light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2));
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
        color: inherit;
        font-size: 12px;

        &:hover {
          border-color: #ff6b6b;
          color: #ff6b6b;
        }
      }
    }

    .subjects {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        padding: 4px 0;

        .remove {
          background: none;
          border: none;
          color: #ff6b6b;
          font-size: 12px;
          cursor: pointer;
        }
      }
    }

    .add-subject {
      display: flex;
      gap: 8px;

      input {
        flex: 1;
        font-size: 13px;
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px solid light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.15));
        background: light-dark(#fff, rgba(255, 255, 255, 0.06));
        color: inherit;
        outline: none;
      }

      button {
        background: #00c2a8;
        color: #0d1b2a;
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }
    }
  }
</style>
