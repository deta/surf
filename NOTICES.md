# Third-Party Notices

## @ghostery/adblocker-electron

This project includes modifications to @ghostery/adblocker-electron, which is
licensed under the Mozilla Public License 2.0.

Original source: https://github.com/ghostery/adblocker
License: Mozilla Public License 2.0

### Modifications Made

We have applied patches to the following files:

- `dist/adblocker.umd.min.js`
- `dist/commonjs/index.js`
- `dist/esm/index.js`
- Related TypeScript definition files

Changes: Added optional parameter `registerWebRequestHandlers` to control
whether web request handlers are registered, allowing more flexible integration
with Electron applications.

The complete patches are maintained in our repository in the `patches/` directory.

Modified source code is available at: https://github.com/deta/adblocker
