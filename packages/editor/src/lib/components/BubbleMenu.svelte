<script lang="ts">
    import type { Readable } from 'svelte/store';
    import { BubbleMenu, type Editor } from 'svelte-tiptap';

    import Icon from '../icons/Icon.svelte';
  
    export let editor: Readable<Editor>

    $: isActive = (name: string, attrs = {}) => $editor.isActive(name, attrs);


    const setLink = () => {
        const url = prompt('URL');

        if (url) {
            $editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
    };
</script>

<BubbleMenu editor={$editor}>
    <div class="bubble-menu">
        <div class="menu-section">
            <button
                class:active={isActive('bold')}
                on:click={() => $editor.chain().focus().toggleBold().run()}
            >
                <Icon name="bold" />
            </button>

            <button
                class:active={isActive('italic')}
                on:click={() => $editor.chain().focus().toggleItalic().run()}
            >
                <Icon name="italic" />
            </button>

            <button
                class:active={isActive('strike')}
                on:click={() => $editor.chain().focus().toggleStrike().run()}
            >
                <Icon name="strike" />
            </button>

            <button
                class:active={isActive('code')}
                on:click={() => $editor.chain().focus().toggleCode().run()}
            >
                <Icon name="code" />
            </button>

            <button
                class:active={isActive('link')}
                on:click={() => (isActive('link') ? $editor.chain().focus().extendMarkRange('link').unsetLink().run() : setLink())}
            >
                <Icon name="link" />
            </button>
        </div>

        <!-- <div class="divider"></div>

        <div class="menu-section">
            <button
                class:active={isActive('heading', { level: 1 })}
                on:click={() => $editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
                <Icon name="h1" />
            </button>

            <button
                class:active={isActive('heading', { level: 2 })}
                on:click={() => $editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Icon name="h2" />
            </button>

            <button
                
                on:click={() => $editor.chain().focus().setParagraph().run()}
            >
                <Icon name="paragraph" />
            </button>

            <button
                class:active={isActive('bulletList')}
                on:click={() => $editor.chain().focus().toggleBulletList().run()}
            >
                <Icon name="list" />
            </button>

            <button
                class:active={isActive('orderedList')}
                on:click={() => $editor.chain().focus().toggleOrderedList().run()}
            >
                <Icon name="list-numbered" />
            </button>

            <button
                class:active={isActive('taskList')}
                on:click={() => $editor.chain().focus().toggleTaskList().run()}
            >
                <Icon name="list-check" />
            </button>

            <button
                class:active={isActive('blockquote')}
                on:click={() => $editor.chain().focus().toggleBlockquote().run()}
            >
                <Icon name="list-check" />
            </button>
        </div> -->
    </div>
</BubbleMenu>

<style lang="scss">
    .bubble-menu {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: var(--background-menu);
        border-radius: 0.5rem;
        padding: 0.35rem 0.5rem;
        border: 1px solid var(--background-menu-muted);

        .menu-section {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .divider {
            width: 1px;
            height: 1.5rem;
            background: var(--color-menu-muted);
        }

        button {
            cursor: pointer;
            display: flex;
            background: none;
            border: none;
            outline: none;
            margin: 0;
            padding: 0;
            color: var(--color-menu-muted);
            transition: all 0.2s ease-in-out;

            &:hover {
                color: var(--color-menu);
            }

            &.active {
                color: var(--color-menu);
            }
        }
    }
</style>
