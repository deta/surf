# leptonica-sys

Rust FFI bindings to [Leptonica](http://www.leptonica.org/).

Types and functions generated from the functions listed in
[allheaders.h](https://github.com/DanBloomberg/leptonica/blob/master/src/allheaders.h).

## Help wanted

[Windows and Mac maintainers wanted](https://github.com/ccouzens/leptonica-sys/issues/17).

## Building

This links to the C library Leptonica.

On Fedora 30 the build dependencies can be installed by running:

```bash
sudo dnf install leptonica-devel clang
```

On Termux 2019 (Android, Android on Chromebooks) the additional dependencies can be installed by running:

```bash
pkg install libclang leptonica-dev
```

### Building on Windows

On Windows, this library uses Microsoft's [vcpkg](https://github.com/microsoft/vcpkg) to provide leptonica.

Please install [vcpkg](https://github.com/microsoft/vcpkg) and **set up user wide integration** or [vcpkg crate](https://crates.io/crates/vcpkg) won't be able to find the library.
By default vcpkg installs 32 bit libraries. If you need 64 bit libraries then set following environment variable

```cmd
SET VCPKG_DEFAULT_TRIPLET=x64-windows
```

To install leptonica

```cmd
REM from the vcpkg directory
.\vcpkg install leptonica
```

vcpkg allows building either dynamically or statically linked application

if you prefer dynamic linking

```cmd
SET VCPKGRS_DYNAMIC=true
```

for statically linked libraries

```cmd
SET RUSTFLAGS=-Ctarget-feature=+crt-static
```

If you prefer to compile tesseract yourself (Because, for example, you could not get vcpkg to build using clang-cl.exe), you can set these environment variables: `LEPTONICA_INCLUDE_PATH`, `LEPTONICA_LINK_PATHS` and `LEPTONICA_LINK_LIBS`.

For example:

```
set LEPTONICA_INCLUDE_PATH=D:\leptonica\build\include
set LEPTONICA_LINK_PATHS=D:\leptonica\build\lib
set LEPTONICA_LINK_LIBS=leptonica-1.83.0
```
