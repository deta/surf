# Contributing to Deta Surf

We welcome contributions from the community to help improve Deta Surf! Whether you're fixing bugs, adding new features, or improving documentation, your contributions are valuable to us.

Please note that Surf has been open-sourced for transparency and community involvement, but it is still in active development. A lot of the code has been written quickly to prototype features, so please be patient and understanding when contributing.

We encourage you to review the current issues and feature requests before contributing. If you find something you'd like to work on, please comment on the issue or create a new one to let us know you're interested.

## Code of Conduct

This project and everyone participating in it is governed by the [Surf Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [hello@deta.surf](mailto:hello@deta.surf).

## I need help!

If you need help getting started or have questions about the codebase, feel free to reach out to us on our [Discord server](http://deta.surf/discord), open an issue on GitHub or email us at [hello@deta.surf](mailto:hello@deta.surf).

## What's inside?

The Deta Surf codebase is structured as a monorepo with several ´packages´ and the core Electron application in `app`. It uses Yarn Workspaces and Turborepo to manage dependencies and build processes.

### Core App

The core Electron application is located in the `app` folder. It is built with [electron-vite](https://electron-vite.org) and uses the other packages in this monorepo as dependencies.

The core app is split into the different processes, `main`, `preload` and `renderer`.

Within the `renderer` there are several different entrypoints for the different view types in Surf, each one essentially acts as its own web application (using Svelte):

- `Core`: main app UI
- `Resource`: notebooks and resource views like the notes
- `PDF`: custom PDF viewer
- `Overlay`: overlay window used for dialogs and other floaty UIs^
- `Settings`: settings window
- `Setup`: setup window
- `Updates`: updates window
- `Announcements`: announcements window

Within the `preload` there are different scripts for the different view types, each one exposing a tailored API to the renderer process via `contextBridge`. The most important are:

- `core`: for main app UI renderer
- `resource`: for the resource renderer
- `webcontents`: for external web pages

The `main` directory is the main process of the Electron app, responsible for window management, app lifecycle, IPC handling and more. It's the entrypoint of the Electron app.

### Packages

- `@deta/backend`: a Rust backend that's compiled to a Node.js module
- `@deta/backend-server`: a Rust backend that's compiled to a standalone server, responsible for compute intensive AI tasks (embeddings)
- `@deta/services`: core services powering the application like tabs, resources, notebooks, settings, etc.
- `@deta/editor`: Tiptap based rich text editor component
- `@deta/teletype`: custom command menu library
- `@deta/dragcula`: drag and drop library
- `@deta/web-parser`: web content parsing library used for resource extraction / web clipping
- `@deta/ui`: UI component library
- `@deta/utils`: shared utilities used by multiple packages and the app
- `@deta/icons`: icon library based on [`tabler`](https://tabler.io/icons)
- `@deta/types`: shared TypeScript types used throughout the monorepo

Each package is either written in [TypeScript](https://www.typescriptlang.org/) or Rust, the UI parts are built with [Svelte](https://svelte.dev/).

## Installation

To use a non-notarized version on MacOS:

- download a suitable `dmg` from [releases](https://github.com/deta/horizon/releases)
- move it to your `Applications` folder
- run `xattr -cr /Applications/{release_name}.app` in your Terminal, replace {release_name} with the actual release name
- start the app

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (version `22.18.0` or higher)
- [Yarn](https://yarnpkg.com/) (version 1.x)
- [Rust and Cargo](https://www.rust-lang.org/tools/install)

### Install Dependencies

Run the following command to install all dependencies:

```sh
yarn install
```

### Develop

To run the app and required packages in development mode, run the following command:

```sh
yarn dev
```

### Build

To build all apps and packages, run the following command:

```sh
yarn build
```

To create the final distributable build, run the following command:

Mac (Arm):

```sh
yarn build:desktop:mac:arm
```

or for Windows (x64):

```sh
yarn build:desktop:win:x64
```

Check the `package.json` scripts section for more build options.

# 📌 How to Contribute

### 1. Fork & Branch

- Fork this repository
- Create a new branch for your changes
  ```bash
  git checkout -b feature/my-feature

  ```

### 2. Make Changes

Write clean, well-documented code. Include tests when applicable.

### 3. Commit with Signed-off-by

This project uses a **Developer Certificate of Origin (DCO)** to certify contribution rights.

Each commit **must be signed** by adding a `Signed-off-by` line to your commit message:

```bash
git commit -s -m "Add new feature"

```

This will automatically add:

```
Signed-off-by: Your Name <you@example.com>

```

If you forgot to sign a commit, you can fix it with:

```bash
git commit --amend --signoff

```

---

## ✅ Developer Certificate of Origin (DCO)

By contributing, you agree to the Developer Certificate of Origin:

```
Developer Certificate of Origin
Version 1.1

By making a contribution to this project, I certify that:

(a) The contribution is my original work, and I have the right to submit it under the open source license indicated in the file; or

(b) The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications, whether created in whole or in part by me, under the same open source license; or

(c) The contribution was provided directly to me by some other person who certified (a), (b) or (c) and I have not modified it; and

(d) I understand and agree that this project and its contributions are public and that a record of the contribution (including my name and email) is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.
```

---

## 📥 Pull Requests

Before submitting a pull request:

- Make sure your code builds without errors
- Follow existing code style
- Add tests if needed
- Include a clear description of the change

---

## 🛡 License

By contributing, you agree that your contributions will be licensed under the **Apache License 2.0**, in line with this repository.

---

If you have any questions, feel free to open an issue. Thank you for your contribution!
