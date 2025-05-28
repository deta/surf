<script lang="ts">
  import { Icon } from '@horizon/icons'

  // Add event handlers for the buttons
  function createNote() {
    // Add note creation logic here
    console.log('Creating a new note')
  }

  function addFiles() {
    // Add file upload logic here
    console.log('Adding files')
  }

  function createSubContext() {
    // Add sub-context creation logic here
    console.log('Creating sub-context')
  }
</script>

<div class="empty-wrapper">
  <header>
    <Icon name="save" size="22px" />
    <h2>Add your first Items</h2>
    <p>You can drag and drop, paste links or save any tab.</p>
  </header>

  <!-- <div class="actions">
    <button on:click={createNote} class="action-button"> New Note </button>
    <button on:click={addFiles} class="action-button"> Add Files </button>
    <button on:click={createSubContext} class="action-button"> Create Sub-Context </button>
  </div> -->
</div>

<style lang="scss">
  :root {
    --primary-color: #3a53ff;
    --primary-hover: #426eff;
    --button-text-color: #ffffff;
    --heading-text-color: #111827;
    --paragraph-text-color: #4b5563;
    --heading-size: 1.5rem;
    --button-text-size: 13px;
    --button-radius: 0.65rem;
    --transition-speed: 0.5s;
    --shine-opacity: 0.3;
    --shadow-light: rgba(0, 0, 0, 0.05);
    --shadow-medium: rgba(0, 0, 0, 0.1);
  }

  h2 {
    font-size: var(--heading-size);
    margin: 0;
    font-weight: 600;
    color: var(--heading-text-color);
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--paragraph-text-color);
  }

  .empty-wrapper {
    position: relative;
    top: 12rem;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
    gap: 12px;
  }

  .action-button {
    /* Base styling */
    background-color: var(--primary-color);
    padding: 0.65rem 1rem 0.75rem 1rem;
    border-radius: var(--button-radius);
    font-size: var(--button-text-size);
    font-weight: 500;
    color: var(--button-text-color);
    line-height: 1;
    text-align: center;
    justify-content: center;
    cursor: pointer;
    border: none;

    /* Transition effects */
    transition: all var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);

    /* Shine effect */
    border-top: 0.5px solid rgba(255, 255, 255, var(--shine-opacity));
    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));

    /* Shadow effect */
    box-shadow:
      0 1px var(--shadow-light),
      0 1.5px 2px var(--shadow-medium),
      inset 0 -1px var(--shadow-medium);

    /* Hover state */
    &:hover {
      background-color: var(--primary-hover);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(1px);
    }
  }
</style>
