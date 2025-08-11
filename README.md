# Horizon

Monorepo containing the Horizon desktop app, a future web version and all related UI components and logic.

## Installation

To use a non-notarized version on MacOS:

- download a suitable `dmg` from [releases](https://github.com/deta/horizon/releases)
- move it to your `Applications` folder
- run `xattr -cr /Applications/{release_name}.app` in your Terminal, replace {release_name} with the actual release name
- start the app

## Setup

### Install rust and cargo

Run the following command:

```sh
curl https://sh.rustup.rs -sSf | sh
```

### Install js dependencies

Run the following command:

```sh
yarn install
```

## What's inside?

This monorepo includes the following packages/apps:

### Apps and Packages

- `desktop`: a Electron app
- `web`: a svelte app (just a placeholder for now)
- `@horizon/backend`: a Rust backend that's compiled to a Node.js module
- `@horizon/backend-server`: a Rust backend that's compiled to a standalone server, responsible for compute intensive AI tasks (embeddings)
- `@horizon/core`: Horizon specific components and logic shared by both `desktop` and `web` applications
- `@deta/types`: a general Svelte component library shared by both `desktop` and `web` applications
- `@horizon/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@horizon/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/) or Rust.

### Utilities

This monorepo uses Yarn Workspaces and Turborepo among other tools:

- [Yarn Workspaces](https://classic.yarnpkg.com/lang/en/docs/workspaces/)
- [Turborepo](https://turbo.build/)
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
yarn build
```

### Develop

To run the app and required packages in development mode, run the following command:

```
yarn dev:horizon
```

To develop all apps and packages, run the following command (not needed most of the time):

```
yarn dev
```
