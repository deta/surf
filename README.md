<div align="center">
  
![splash](./docs/assets/repo-header.png)

[**Website**](https://deta.surf) - [**Discord**](https://deta.surf/discord)

</div>

<br>

# Deta Surf: Your AI Notebook

Deta Surf is an AI notebook that brings all your files and the web directly into your stream of thought.

It’s meant for simultaneous research and thinking that minimizes the grunt work: manually searching, opening windows & tabs, scrolling, copying and pasting into a document editor.

Surf is primarily built in Svelte, TypeScript and Rust, runs on MacOS, Windows & Linux, stores data locally in open formats, and is open source.

![split](./docs/assets/split-note.webp)

## Motivation

Most applications are focused on a single task, or a single media type: notes, websites, or PDFs. Real thinking requires juggling media across sources to make connections and synthesize ideas. We want to help people think better, across all their media.

Surf is built to be personal and open, in service of the user. This means local first data, open data formats, open source, and openness with respect to AI models. [Read more](https://deta.surf/motivation).

## Installation

Checkout the [installation guide](./docs/INSTALL.md) for detailed instructions.

For building from source and local development, see [CONTRIBUTING.md](CONTRIBUTING.md).

## TL;DR - Things to try

- _YouTube Notes_: visit a YouTube video and ask a question
- _PDF Notes_: open a PDF and ask a question
- _Create an applet_: use the "app generation" tool and ask for an app
- _Notes that search the web_: use the "web search" tool and ask a question with "search" in it

## Features

### Multi-Media Library & Notebooks

![notebooks](./docs/assets/readme/notebook-grid.png)

Store almost any media in a private library on your computer, in an open and transparent format.

- Support for local files, sites & links from the web (YouTube, Tweets & more), or create media directly in Surf.
- Organize this library into Notebooks.
- Open and use much of your library offline.
- Use your library to power Surf’s AI features.

Surf's library is built on a local storage engine called SFFS (Surf Flat File System), which stores data in open and transparent formats.

[Details on the library](/docs/LIBRARY.md).

### Smart Notes

![smart-notes](./docs/assets/readme/smart-notes.png)

Explore and think across your digital stuff without opening up a bunch of windows, clicking, scrolling and copying & pasting into your document (or chatbot).

- `@-mention` and auto-generate from any tab, website or any resource in your [library](./docs/LIBRARY.md).
- Trigger [web searches](./docs/SMART_NOTES.md#web-search) to do research, and bring the results back in your notes.
- Integrated [citations](./docs/SMART_NOTES.md#citations) deeplinked to original sources, whether a section on a webpage, a timestamp in a video, or a page in a PDF.
- Generate interactive applications without writing code using [Surflets](./docs/Surflets.md).
- Paste in images, tables or data from other applications and have Surf understand and incorporate them.
- Use rich formating, code blocks, to-do lists and more in your notes.

[Read more](/docs/SMART_NOTES.md).

### Tabs, Split View & Sidebar

![split](./docs/assets/another-split.webp)

Surf is built around tabs, split view and a sidebar for easy navigation.

- Open local notes, files or web pages in tabs.
- Split view allows you to view and interact with multiple resources side by side.
- The sidebar provides quick access to your Notebooks & notes.

### Surflets (App Generation)

![surflets](./docs/assets/readme/surflets.png)

Surf can code interactive applets to help you visualize, understand or explore concepts or data that are aided with code.

[Read more](./docs/SURFLETS.md).

### AI

![models.png](./docs/assets/readme/models.png)

[Surf’s notes](./docs/SMART_NOTES.md) and [Surflets](./docs/SURFLETS.md) are powered by large language models of your choice.

- Bring your own key for popular models
- Add a cloud model
- Use Local Language Models

[Read more](./docs/AI_MODELS.md).

### Shortcuts

Find the most common shortcuts [here](./docs/SHORTCUTS.md).

## Security

_To report a security concern, please see_ https://github.com/deta/surf/security/policy

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on contributing to the project and an overview of the codebase.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details on our code of conduct.

## License

The source code for this project is licensed under the Apache 2.0 license, with the following exceptions:

1. Our patch for the @ghostery/adblocker-electron package is licensed under the Mozilla Public License 2.0 (MPL-2.0), consistent with the upstream project's licensing.
2. Select files may contain their own specific license headers that override the default license.

Unless otherwise specified in the file or directory, all code defaults to the Apache 2.0 license.

See [LICENSE](LICENSE) for more details about the Apache 2.0 license.

**Note:** The Deta name and logos are trademarks of Deta GmbH and are **not** covered by the Apache 2.0 license.

Deta GmbH is a commercial open source company. Surf is designed to operate as open source software without needing Deta's servers. Deta GmbH also offers a modified version of Surf (which integrates with Deta's servers) and is subject to separate terms and conditions. This version of Surf can be downloaded from the [Deta website](https://deta.surf/).

## Acknowledgements

This project makes use of the following open source packages (not a comprehensive list):

- [Electron](https://www.electronjs.org/)
- [Tiptap](https://tiptap.dev/)
- [Svelte](https://svelte.dev/)
- [Rust](https://www.rust-lang.org/)
