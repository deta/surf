<script lang="ts">
  import { onMount } from 'svelte'
  import type { AcostaUser } from '@deta/types'

  let user = $state<AcostaUser | null>(null)

  onMount(() => {
    window.api.acosta
      .getAuthState()
      .then((state) => {
        if (state?.status === 'signed-in') user = state.user
      })
      .catch(() => {})

    const unsub = window.api.acosta.onAuthStateChange((state) => {
      user = state.status === 'signed-in' ? state.user : null
    })
    return unsub
  })

  const initial = $derived((user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase())
</script>

{#if user}
  <button
    class="account-badge"
    title={`${user.displayName ?? 'Student'} — ${user.email}`}
    onclick={() => window.api.openSettings('acosta')}
  >
    {#if user.photoURL}
      <img src={user.photoURL} alt="" referrerpolicy="no-referrer" />
    {:else}
      <span class="initial">{initial}</span>
    {/if}
    {#if user.displayName}
      <span class="name">{user.displayName.split(' ')[0]}</span>
    {/if}
  </button>
{/if}

<style lang="scss">
  .account-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 2px 6px 2px 2px;
    border-radius: 999px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
    }

    img,
    .initial {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
    }

    .initial {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #00c2a8;
      color: #0d1b2a;
      font-size: 11px;
      font-weight: 700;
    }

    .name {
      font-size: 12px;
      opacity: 0.8;
      max-width: 90px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
