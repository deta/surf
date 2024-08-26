use std::env;
use std::path::PathBuf;

fn main() {
    if cfg!(target_os = "macos") {
        println!("cargo:rerun-if-changed=src/macos/monitor.mm");
        println!("cargo:rerun-if-changed=src/macos/monitor.h");

        let out_dir = env::var("OUT_DIR").unwrap();
        let out_path = PathBuf::from(&out_dir);

        cc::Build::new()
            .file("src/macos/monitor.mm")
            .include("src/macos")
            .flag("-fmodules")
            .flag("-fcxx-modules")
            .compile("monitor");

        println!("cargo:rustc-link-search=native={}", out_path.display());
        println!("cargo:rustc-link-lib=static=monitor");
        println!("cargo:rustc-link-lib=framework=Cocoa");
    }
}
