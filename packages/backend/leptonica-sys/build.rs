extern crate bindgen;

use std::env;
use std::path::PathBuf;
#[cfg(windows)]
use vcpkg;

// const MINIMUM_LEPT_VERSION: &str = "1.80.0";

#[cfg(windows)]
fn find_leptonica_system_lib() -> Option<String> {
    println!("cargo:rerun-if-env-changed=LEPTONICA_INCLUDE_PATH");
    println!("cargo:rerun-if-env-changed=LEPTONICA_LINK_PATHS");
    println!("cargo:rerun-if-env-changed=LEPTONICA_LINK_LIBS");

    let vcpkg = || {
        let lib = vcpkg::Config::new().find_package("leptonica").unwrap();

        let include = lib
            .include_paths
            .iter()
            .map(|x| x.to_string_lossy())
            .collect::<String>();
        Some(include)
    };

    let include_path = env::var("LEPTONICA_INCLUDE_PATH").ok();
    let link_paths = env::var("LEPTONICA_LINK_PATHS").ok();
    let link_paths = link_paths.as_deref().map(|x| x.split(','));
    let link_libs = env::var("LEPTONICA_LINK_LIBS").ok();
    let link_libs = link_libs.as_deref().map(|x| x.split(','));
    if let (Some(include_path), Some(link_paths), Some(link_libs)) =
        (include_path, link_paths, link_libs)
    {
        for link_path in link_paths {
            println!("cargo:rustc-link-search={}", link_path)
        }

        for link_lib in link_libs {
            println!("cargo:rustc-link-lib={}", link_lib)
        }

        Some(include_path)
    } else {
        vcpkg()
    }
}

// we sometimes need additional search paths, which we get using pkg-config
// we can use leptonica installed anywhere on Linux.
// if you change install path(--prefix) to `configure` script.
// set `export PKG_CONFIG_PATH=/path-to-lib/pkgconfig` before.
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "freebsd"))]
fn find_leptonica_system_lib() -> Option<String> {
    let pk = pkg_config::Config::new()
        .statik(true)
        .probe("lept")
        .unwrap();

    // this is not okay lmao
    // but the pkg-config file is broken ;(
    println!("cargo:rustc-link-search=native=/opt/homebrew/Cellar/openjpeg/2.5.2/lib/");
    println!("cargo:rustc-link-search=native=/opt/homebrew/Cellar/jpeg-turbo/3.0.2/lib");
    println!("cargo:rustc-link-search=native=/opt/homebrew/Cellar/giflib/5.2.1/lib/");

    println!("cargo:rustc-link-lib=static=gif");
    println!("cargo:rustc-link-lib=static=jpeg");
    println!("cargo:rustc-link-lib=static=openjp2");

    // Tell cargo to tell rustc to link the system proj shared library.
    println!("cargo:rustc-link-search=native={:?}", pk.link_paths[0]);
    println!("cargo:rustc-link-lib=static={}", pk.libs[0]);

    let mut include_path = pk.include_paths[0].clone();
    if include_path.ends_with("leptonica") {
        include_path.pop();
    }
    Some(include_path.to_str().unwrap().into())
}

#[cfg(all(
    not(windows),
    not(target_os = "macos"),
    not(target_os = "linux"),
    not(target_os = "freebsd")
))]
fn find_leptonica_system_lib() -> Option<String> {
    println!("cargo:rustc-link-lib=lept");
    None
}

fn main() {
    let clang_extra_include = find_leptonica_system_lib();

    let mut bindings = bindgen::Builder::default().header("wrapper.h");

    #[cfg(windows)]
    {
        bindings = bindings.clang_args(["-x", "c++"]);
    }

    if let Some(include_path) = clang_extra_include {
        bindings = bindings.clang_arg(format!("-I{}", include_path));
    }

    let bindings = bindings
        .parse_callbacks(Box::new(bindgen::CargoCallbacks))
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
