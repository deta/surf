fn main() {
    if std::env::var("PROFILE").unwrap() == "debug" {
        if let Ok(ld_library_path) = std::env::var("LD_LIBRARY_PATH") {
            for path in ld_library_path.split(':') {
                println!("cargo:rustc-link-arg=-Wl,-rpath,{}", path);
            }
        }
    }
}
