<script lang="ts">
    import {
        Bold,
        Italic,
        Strike,
        Code,
        H1,
        H2,
        Link,
        Paragraph,
        List,
        ListNumbered,
        ListCheck,
        Quote,
        CodeBlock,
    } from "./index";

    export let size = '18px';
    export let name: keyof typeof icons;

    const icons = {
        'bold': Bold,
        'italic': Italic,
        'strike': Strike,
        'code': Code,
        'h1': H1,
        'h2': H2,
        'h3': H2,
        'link': Link,
        'paragraph': Paragraph,
        'list': List,
        'list-numbered': ListNumbered,
        'list-check': ListCheck,
        'quote': Quote,
        'code-block': CodeBlock,
    }
</script>

<svelte:component this={icons[name]} size={size} {...$$restProps} />
