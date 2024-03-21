fn main() {}
// fn main() {
//     let libs = ["libjpeg", "libopenjp2"];

//     for pkg_name in libs {
//         let library = pkg_config::Config::new()
//             .statik(true)
//             .probe(pkg_name)
//             .unwrap_or_else(|_| panic!("Could not find {} via pkg-config", pkg_name));

//         println!("cargo:rustc-link-search=native={:?}", library.link_paths[0]);
//         println!("cargo:rustc-link-lib=static={}", library.libs[0]);
//     }

//     println!("cargo:rustc-link-search=native=/opt/homebrew/Cellar/giflib/5.2.1/lib");
//     println!("cargo:rustc-link-lib=static=gif");
// }
