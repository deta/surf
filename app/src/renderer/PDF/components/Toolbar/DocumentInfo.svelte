<script lang="ts">
  import { Button } from '@deta/ui'
  import Portal from 'svelte-portal'
  import { clsx } from 'clsx'
  import Tooltip from '../../Tooltip.svelte'
  import { pdfSlickStore } from '../../store'

  export let isOpen = false

  function formatBytes(bytes: number | undefined, decimals: number) {
    if (!bytes || bytes == 0) return '0 Bytes'
    var k = 1024,
      dm = decimals || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
</script>

<Button size="md" square onclick={() => (isOpen = true)}>
  <iconify-icon height="1em" icon="codicon:info" />
  <Tooltip position="bottom" alignX="right">
    <p class="whitespace-nowrap">Document Properties</p>
  </Tooltip>
</Button>

<Portal target="body">
  <div
    class={clsx('relative z-50', {
      'opacity-0 invisible z-0 delay-300': !isOpen,
      'opacity-100 visible z-10 delay-0 duration-0': isOpen
    })}
  >
    <div
      class={clsx('fixed inset-0 bg-black backdrop-blur-sm bg-opacity-5', {
        'ease-out duration-300 opacity-100': isOpen,
        'ease-in duration-200 opacity-0': !isOpen
      })}
      on:click={() => {
        isOpen = false
      }}
      role="none"
    />

    <div class="fixed inset-0 overflow-y-auto pointer-events-none">
      <div class="flex min-h-full items-center justify-center p-4 text-center">
        <div
          class={clsx(
            'pointer-events-auto w-full max-w-lg transform overflow-hidden rounded-sm border border-slate-300 bg-white py-6 text-left align-middle shadow-sm transition-all',
            {
              'ease-out duration-300 opacity-100 scale-100': isOpen,
              'ease-in duration-200 opacity-0 scale-95': !isOpen
            }
          )}
        >
          <h3 class="text-lg font-medium leading-6 text-gray-900 px-6 pb-4">Document Properties</h3>
          <dl class="">
            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">File name</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.filename}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.filename}
                {/if}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">File size</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.filesize}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {formatBytes($pdfSlickStore?.filesize, 2)}
                {/if}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Title</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.title}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.title}
                {/if}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Author</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.author}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.author}
                {/if}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Subject</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.subject}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.subject}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Keywords</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.keywords}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.keywords}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Creation Date</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.creationDate}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'medium'
                  }).format($pdfSlickStore?.creationDate ?? new Date())}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Modification Date</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.modificationDate}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'medium'
                  }).format($pdfSlickStore?.modificationDate ?? new Date())}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Creator</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.creator}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.creator}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">PDF Producer</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.producer}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.producer}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">PDF Version</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.version}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.version}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Page Count</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.numPages}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.numPages}
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Page Size</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {#if !$pdfSlickStore?.pageSize}
                  <span class="text-xs text-gray-500">N/A</span>
                {:else}
                  {$pdfSlickStore?.pageSize?.width} x{' '}
                  {$pdfSlickStore?.pageSize?.height}{' '}
                  {$pdfSlickStore?.pageSize?.unit} (
                  {$pdfSlickStore?.pageSize?.name ? $pdfSlickStore?.pageSize?.name + ', ' : ''}
                  {$pdfSlickStore?.pageSize?.orientation})
                {/if}
              </dd>
            </div>

            <div class="grid grid-cols-3 gap-4 px-6 py-1 my-0.5 hover:bg-slate-50">
              <dt class="text-sm font-medium text-gray-500">Fast Web View</dt>
              <dd class="text-sm text-gray-900 col-span-2">
                {$pdfSlickStore?.isLinearized ? 'Yes' : 'No'}
              </dd>
            </div>
          </dl>

          <div class="mt-4 px-6 flex justify-center">
            <button
              type="button"
              class="inline-flex justify-center rounded border border-transparent bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              on:click={() => {
                isOpen = false
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</Portal>
