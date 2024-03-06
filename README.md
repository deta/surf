# Horizon

Monorepo containing the Horizon desktop app, a future web version and all related UI components and logic.

## Installation

To use a non-notarized version on MacOS:

- download a suitable `dmg` from [releases](https://github.com/deta/horizon/releases)
- move it to your `Applications` folder
- run `xattr -cr /Applications/{release_name}.app` in your Terminal, replace {release_name} with the actual release name
- start the app

## Setup

### Install js dependencies

Run the following command:

```sh
yarn install
```

### Install rust and cargo

Run the following command:

```sh
brew install libomp
curl https://sh.rustup.rs -sSf | sh
```

### Troubelshooting Builds

`libomp` is required for sqlite vector search. If `yarn dev` does not work from the start, look at the output of the command:

```sh
brew info libomp
```

The output should show the location where the lib is installed at.

```txt
...
==> Caveats
libomp is keg-only, which means it was not symlinked into /opt/homebrew,
because it can override GCC headers and result in broken builds.

For compilers to find libomp you may need to set:
  export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
  export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
```

In the `caveats` section, you will find the `LDFLAGS` flag which shows the location of the lib.

Copy this flag and replace it in the `packages/backend/.cargo/config.toml` file.

```toml
[net]
git-fetch-with-cli = true

[target.x86_64-apple-darwin]
rustflags = ["-C", "link-arg=-undefined", "-C", "link-arg=dynamic_lookup"]

[target.aarch64-apple-darwin]
rustflags = [
  "-C",
  "link-arg=-Wl",
  "-C",
  "link-arg=-undefined",
  "-C",
  "link-arg=dynamic_lookup",
  "-C",
  "link-arg=-lomp",
  "-C",
  # this is required for sqlite vss
  # libomp is installed in /opt/homebrew/opt/libomp/lib normally with homebrew
  # if you installed it with another package manager, you will need to change this path to where libomp is installed
  # TODO: have a better way to handle this
  "link-arg={replace me without the curly braces including the -L flag}",
]

```

Also the first `yarn dev` might run without the backend being compiled in time. If you see that your backend changes are not reflected in the app, you can run the following command to build the backend first separately:

```sh
cd packages/backend
yarn build
```

### Cleaning up the data directory

When you start the app with `yarn dev`, it will log the location of the data directory.

```txt
data root path: {path to data directory}
```

This log might be a bit hidden in the logs, so you might need to search for it.
Whenever we change the schema of the database, we need to delete the data directory to start with a fresh database.

## What's inside?

This monorepo includes the following packages/apps:

### Apps and Packages

- `desktop`: a Electron app
- `web`: a svelte app (just a placeholder for now)
- `@horizon/backend`: a Rust backend
- `@horizon/core`: Horizon specific components and logic shared by both `desktop` and `web` applications
- `@horizon/types`: a general Svelte component library shared by both `desktop` and `web` applications
- `@horizon/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@horizon/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/) except the rust backend.

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
