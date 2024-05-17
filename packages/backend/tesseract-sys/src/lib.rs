#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

use leptonica_sys::*;

include!(concat!(env!("OUT_DIR"), "/capi_bindings.rs"));
include!(concat!(env!("OUT_DIR"), "/public_types_bindings.rs"));

#[cfg(test)]
mod tests {
    use super::*;
    use leptonica_sys::{pixFreeData, pixRead};
    use std::ffi::CStr;
    use std::ptr;

    #[test]
    fn ocr() {
        unsafe {
            let cube = TessBaseAPICreate();
            TessBaseAPIInit3(cube, ptr::null(), b"eng\0".as_ptr().cast());
            let image = pixRead(b"img.png\0".as_ptr().cast());
            TessBaseAPISetImage2(cube, image);
            TessBaseAPIRecognize(cube, ptr::null_mut());
            let text = TessBaseAPIGetUTF8Text(cube);
            assert_eq!(
                CStr::from_ptr(text).to_str(),
                Ok(include_str!("../img.txt"))
            );
            TessDeleteText(text);
            pixFreeData(image);
            TessBaseAPIDelete(cube);
        }
    }

    #[test]
    #[allow(path_statements)]
    fn defined_constants() {
        kMinCredibleResolution;
        kMaxCredibleResolution;
    }
}
