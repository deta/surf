#!/bin/bash

BASE_DIR="./external-deps"

mkdir -p "$BASE_DIR"

LIBTORCH_DIR="$BASE_DIR/libtorch"
LIBTORCH_URL="https://download.pytorch.org/libtorch/cpu/libtorch-macos-$(uname -m)-2.2.0.zip"
TEMP_ZIP="./libtorch.zip"

LIBOMP_DYLIB_SOURCE="$(brew --prefix libomp)/lib/libomp.dylib"
LIBOMP_DYLIB_DEST="$BASE_DIR/libtorch/lib/libomp.dylib"

# setup libtorch
if [ ! -d "$LIBTORCH_DIR" ] || [ ! "$(ls -A $LIBTORCH_DIR)" ]; then
  curl -L "$LIBTORCH_URL" -o "$TEMP_ZIP"
  unzip -q "$TEMP_ZIP" -d "$BASE_DIR"
  rm "$TEMP_ZIP"
fi

# libtorch requires libomp to be in @rpath for some reason
cp -n "$LIBOMP_DYLIB_SOURCE" "$LIBOMP_DYLIB_DEST"
chmod 755 "$LIBOMP_DYLIB_DEST"
# install_name_tool -id @rpath/libomp.dylib "$LIBOMP_DYLIB_DEST"

exit 0
