use std::path::PathBuf;

#[cfg(feature = "download-libs")]
use flate2::read::GzDecoder;
#[cfg(feature = "download-libs")]
use std::io::BufReader;
#[cfg(feature = "download-libs")]
use tar::Archive;
#[cfg(feature = "download-libs")]
use ureq::get;
#[cfg(feature = "download-libs")]
use zip::read::ZipArchive;

#[cfg(feature = "download-libs")]
enum Platform {
    MacosX86_64,
    MacosAarch64,
    LinuxX86_64,
}

#[cfg(not(feature = "download-libs"))]
fn download_static_for_platform(
    _os: &str,
    _arch: &str,
    _version: String,
    _output_directory: &PathBuf,
) {
}
#[cfg(feature = "download-libs")]
fn download_static_for_platform(os: &str, arch: &str, version: String, output_directory: &PathBuf) {
    let platform = match (os, arch) {
        ("linux", "x86_64") => Platform::LinuxX86_64,
        ("macos", "x86_64") => Platform::MacosX86_64,
        ("macos", "aarch64") => Platform::MacosAarch64,
        _ => panic!("Unsupported platform: {os} {arch}"),
    };

    let base = "https://github.com/asg017/sqlite-vss/releases/download";
    let url = match platform {
        Platform::MacosX86_64 => {
            format!("{base}/{version}/sqlite-vss-{version}-static-macos-x86_64.tar.gz")
        }

        Platform::MacosAarch64 => {
            format!("{base}/{version}/sqlite-vss-{version}-static-macos-aarch64.tar.gz")
        }
        Platform::LinuxX86_64 => {
            format!("{base}/{version}/sqlite-vss-{version}-static-linux-x86_64.tar.gz")
        }
    };

    println!("{url}");
    let response = get(url.as_str()).call().expect("Failed to download file");
    println!("{}", response.get_url());
    let mut reader = response.into_reader();

    if url.ends_with(".zip") {
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf).unwrap();
        let mut archive =
            ZipArchive::new(std::io::Cursor::new(buf)).expect("Failed to open zip archive");
        archive
            .extract(output_directory)
            .expect("failed to extract .zip file");
    } else {
        let buf_reader = BufReader::new(reader);
        let decoder = GzDecoder::new(buf_reader);
        let mut archive = Archive::new(decoder);
        archive
            .unpack(output_directory)
            .expect("Failed to extract tar.gz file");
    }
}
fn main() {
    let version = format!("v{}", env!("CARGO_PKG_VERSION"));
    let os = std::env::var("CARGO_CFG_TARGET_OS").expect("CARGO_CFG_TARGET_OS not found");
    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").expect("CARGO_CFG_TARGET_ARCH not found");

    let output_directory = if cfg!(feature = "download-libs") {
        let output_directory = std::path::Path::new(std::env::var("OUT_DIR").unwrap().as_str())
            .join(format!("sqlite-vss-v{version}-{os}-{arch}"));
        if !output_directory.exists() {
            download_static_for_platform(os.as_str(), arch.as_str(), version, &output_directory);
        }
        output_directory
    } else {
        std::env::var("LIB_SQLITE_VSS").expect("The LIB_SQLITE_VSS environment variable needs to be defined if the download-libs feature is not enabled").into()
    };

    println!("cargo:rerun-if-env-changed=LIB_SQLITE_VSS");
    println!(
        "cargo:rustc-link-search=native={}",
        output_directory.to_string_lossy()
    );
    println!("cargo:rustc-link-lib=static=faiss_avx2");
    println!("cargo:rustc-link-lib=static=sqlite_vector0");
    println!("cargo:rustc-link-lib=static=sqlite_vss0");

    if cfg!(target_os = "macos") {
        // link statically with libomp
        let libomp_path = std::process::Command::new("brew")
            .args(["--prefix", "libomp"])
            .output()
            .unwrap();
        if !libomp_path.status.success() {
            panic!("brew command failed for libomp");
        }
        let libomp_path = String::from_utf8_lossy(&libomp_path.stdout);
        let libomp_path = format!("{}/lib", libomp_path.trim_end());

        println!("cargo:rustc-link-search=native={}", libomp_path);
        println!("cargo:rustc-link-lib=static=omp");

        // ths is for other stuff ig?
        println!("cargo:rustc-link-arg=-Wl,-undefined,dynamic_lookup");
    } else if cfg!(target_os = "linux") {
        // TODO different builds of faiss/sqlite-vss may require other libs
        println!("cargo:rustc-link-lib=dylib=gomp");
        println!("cargo:rustc-link-lib=dylib=atlas");
        println!("cargo:rustc-link-lib=dylib=blas");
        println!("cargo:rustc-link-lib=dylib=lapack");
        println!("cargo:rustc-link-lib=dylib=m");
        println!("cargo:rustc-link-lib=dylib=stdc++");
    }
}
