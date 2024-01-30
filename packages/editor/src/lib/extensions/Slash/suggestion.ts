import Slash from './Slash.svelte';
import tippy from 'tippy.js';

export default {
	items: ({ query }) => {
		return [
            {
                icon: 'paragraph',
				title: 'Plain Text',
                keywords: ['plain', 'text', 'paragraph'],
				command: ({ editor, range }) => {
					editor.chain().focus().deleteRange(range).setParagraph().run();
				}
			},
			{
                icon: 'h1',
				title: 'Heading 1',
                keywords: ['1', 'first', 'heading', 'title'],
				command: ({ editor, range }) => {
					editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
				}
			},
			{
                icon: 'h2',
				title: 'Heading 2',
                keywords: ['2', 'second', 'heading', 'title'],
				command: ({ editor, range }) => {
					editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
				}
			},
			{
                icon: 'h3',
				title: 'Heading 3',
                keywords: ['3', 'third', 'heading', 'title'],
				command: ({ editor, range }) => {
					editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
				}
			},
            {
                icon: 'list',
				title: 'Bulleted List',
                keywords: ['list', 'bullet', '-', 'unordered'],
				command: ({ editor, range }) => {
					editor.chain().deleteRange(range).focus().toggleBulletList().run();
				}
			},
            {
                icon: 'list-numbered',
				title: 'Numbered List',
                keywords: ['list', 'numbered', 'ordered'],
				command: ({ editor, range }) => {
					editor.chain().deleteRange(range).focus().toggleOrderedList().run();
				}
			},
            {
                icon: 'list-check',
				title: 'To-Do List',
                keywords: ['list', 'tasks', 'to do', 'checked'],
				command: ({ editor, range }) => {
					editor.chain().deleteRange(range).focus().toggleTaskList().run();
				}
			},
            {
                icon: 'quote',
				title: 'Blockquote',
                keywords: ['quote', '>'],
				command: ({ editor, range }) => {
					editor.chain().deleteRange(range).focus().toggleBlockquote().run();
				}
			},
            {
                icon: 'code-block',
				title: 'Code Block',
                keywords: ['code', 'block', '```'],
				command: ({ editor, range }) => {
					editor.chain().deleteRange(range).focus().toggleCodeBlock().run();
				}
			},
		]
			.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || item.keywords.some((keyword) => keyword.includes(query.toLowerCase())))
			.slice(0, 10);
	},

	render: () => {
		let component, popup;
		let selected = false;

		return {
			onStart: (props) => {
				let element = document.createElement('div');
				component = new Slash({
					target: element,
					props: {
						editor: props.editor,
						range: props.range,
						items: props.items
					}
				});

				popup = tippy('body', {
					getReferenceClientRect: props.clientRect,
					appendTo: () => document.body,
					content: element,
					showOnCreate: true,
					interactive: true,
					trigger: 'manual',
					placement: 'bottom-start'
				});
			},

			onUpdate(props) {
				component.$set({
					editor: props.editor,
					range: props.range,
					items: props.items
				});
				if (!props.clientRect) {
					return;
				}

				popup[0].setProps({
					getReferenceClientRect: props.clientRect
				});
			},

			onKeyDown(props) {
				if (props.event.key === 'Escape') {
					popup[0].hide();
					return true;
				}
				if (props.event.key === 'Enter') {
					selected = true;
					props.event.preventDefault();
					return true;
				}
			},

			onExit() {
				popup[0].destroy();
				component.$destroy();
			}
		};
	}
};