#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

include!(concat!(env!("OUT_DIR"), "/bindings.rs"));

#[cfg(test)]
mod tests {
    use super::{pixFreeData, pixGetHeight, pixGetWidth, pixRead};

    #[test]
    fn image_size() {
        unsafe {
            let image = pixRead(b"../test image.png\0".as_ptr().cast());
            assert_eq!(pixGetWidth(image), 1000);
            assert_eq!(pixGetHeight(image), 500);
            pixFreeData(image);
        }
    }

    #[test]
    #[allow(path_statements)]
    fn defined_constants() {
        super::IFF_UNKNOWN;
        super::IFF_BMP;
    }
}
