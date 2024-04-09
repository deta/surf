# tesseract-sys

Rust bindings for [Tesseract](https://github.com/tesseract-ocr/tesseract). Requires version `4.1.0` or newer.

## Building

This links to the C libraries [leptonica](https://github.com/danbloomberg/leptonica) and tesseract.

On Ubuntu and derivatives the additional dependencies can be installed by running:

```bash
sudo apt-get install libleptonica-dev libtesseract-dev clang
```

On Fedora 30 the additional dependencies can be installed by running:

```bash
sudo dnf install leptonica-devel tesseract-devel clang
```

On Termux 2019 (Android, Android on Chromebooks) the additional dependencies can be installed by running:

```bash
pkg install libclang leptonica-dev tesseract-dev
```

### Building on Windows

On Windows, this library uses Microsoft's [vcpkg](https://github.com/microsoft/vcpkg) to provide tesseract.

Please install [vcpkg](https://github.com/microsoft/vcpkg) and **set up user wide integration** or [vcpkg crate](https://crates.io/crates/vcpkg) won't be able to find a library.

To install tesseract

```cmd
REM from the vcpkg directory

REM 32 bit
.\vcpkg install tesseract:x86-windows

REM 64 bit
.\vcpkg install tesseract:x64-windows
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

To run the tests please download the [English trained data](https://github.com/tesseract-ocr/tessdata/blob/master/eng.traineddata) to this directory and set

```cmd
SET TESSDATA_PREFIX=.
```

If you prefer to compile tesseract yourself (Because, for example, you could not get vcpkg to build using clang-cl.exe), you can set these environment variables: `TESSERACT_INCLUDE_PATHS`, `TESSERACT_LINK_PATHS` and `TESSERACT_LINK_LIBS`.

For example:

```
set TESSERACT_INCLUDE_PATHS=D:\tesseract\build\include
set TESSERACT_LINK_PATHS=D:\tesseract\build\lib
set TESSERACT_LINK_LIBS=tesseract41
```
