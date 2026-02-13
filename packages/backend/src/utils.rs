use mime2ext::mime2ext;
use regex::Regex;

const BASE62_CHARS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Convert a UUID to base62 string for shorter representation
pub fn uuid_to_base62(uuid: &str) -> String {
    // Remove hyphens and convert to u128
    let uuid = uuid.replace("-", "");
    let mut num = u128::from_str_radix(&uuid, 16).unwrap_or(0);

    let mut result = Vec::new();
    while num > 0 {
        let rem = (num % 62) as usize;
        result.push(BASE62_CHARS[rem]);
        num /= 62;
    }

    // Reverse and convert to string
    String::from_utf8(result.into_iter().rev().collect()).unwrap_or_default()
}

/// Sanitize a filename to be safe for filesystem storage
pub fn sanitize_filename(name: &str) -> String {
    let re = Regex::new(r#"[<>:"\\|?*\x00-\x1F]"#).unwrap();
    let sanitized = re.replace_all(name, "-").into_owned();
    let sanitized = sanitized.replace(|c: char| c.is_whitespace(), " "); // Normalize spaces

    // Remove leading periods
    sanitized.trim_start_matches('.').to_string()
}

/// Generates a filename for a resource, using metadata name if available
/// Otherwise falls back to using just the resource ID
pub fn get_resource_filename(resource_id: &str, metadata_name: Option<&str>) -> String {
    if let Some(name) = metadata_name {
        let short_name = if name.len() > 150 { &name[..150] } else { name };

        let sanitized_name = sanitize_filename(short_name);
        let short_id = uuid_to_base62(resource_id);

        format!("{}-{}", sanitized_name, short_id)
    } else {
        resource_id.to_string()
    }
}

/// Converts a resource type (MIME type) to a file extension.
///
/// This function attempts to determine an appropriate file extension for a given resource type
/// using the following logic:
/// 1. For special space types (application/vnd.space.*), returns "jsong"
/// 2. For document space notes, returns "md"
/// 3. Uses mime_guess to get standard MIME type extensions
/// 4. Falls back to parsing the MIME type manually if mime_guess fails
/// 5. Defaults to "json" for unknown types
///
/// # Arguments
///
/// * `resource_type` - A string slice containing the resource type/MIME type
///
/// # Examples
///
/// ```
/// use crate::utils::get_resource_file_extension;
///
/// assert_eq!(get_resource_file_extension("image/png"), "png");
/// assert_eq!(get_resource_file_extension("application/vnd.space.article"), "jsong");
/// assert_eq!(get_resource_file_extension("application/vnd.space.document.space-note"), "md");
/// assert_eq!(get_resource_file_extension("application/json"), "json");
/// ```
pub fn get_resource_file_extension(resource_type: &str) -> String {
    // Check if it's a markdown resource type first
    let markdown_resource_types = [
        "application/vnd.space.link",
        "application/vnd.space.article",
        "application/vnd.space.post",
        "application/vnd.space.document.space-note",
    ];

    if markdown_resource_types
        .iter()
        .any(|&t| resource_type.starts_with(t))
    {
        return "md".to_string();
    }

    // Special case for space types (keep this for backward compatibility)
    if resource_type.starts_with("application/vnd.space") {
        return "json".to_string();
    }

    // Try to get extension from mime_guess first
    if let Some(ext) = mime2ext(resource_type) {
        return ext.to_string();
    }

    // Fallback: Parse the MIME type manually
    resource_type
        .split('/')
        .next_back()
        .unwrap_or("bin")
        .split('+')
        .next()
        .unwrap_or("json")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_resource_filename() {
        let id = "550e8400-e29b-41d4-a716-446655440000";

        // Test with metadata name
        let result = get_resource_filename(id, Some("My Test File"));
        assert!(result.starts_with("My Test File-"));
        assert!(result.contains('-'));

        // Test with problematic characters
        let result = get_resource_filename(id, Some("My<Test>File*.txt"));
        assert!(result.starts_with("My-Test-File-"));
        assert!(!result.contains('*'));
        assert!(!result.contains('<'));
        assert!(!result.contains('>'));

        // Test fallback to id
        let result = get_resource_filename(id, None);
        assert_eq!(result, id);

        // Test with leading periods
        let result = get_resource_filename(id, Some("...test"));
        assert!(result.starts_with("test-"));
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("test.txt"), "test.txt");
        assert_eq!(sanitize_filename("...test"), "test");
    }

    #[test]
    fn test_get_resource_file_extension() {
        // Test space types
        assert_eq!(
            get_resource_file_extension("application/vnd.space.article"),
            "md"
        );
        assert_eq!(
            get_resource_file_extension("application/vnd.space.something"),
            "json"
        );

        // Test document space note
        assert_eq!(
            get_resource_file_extension("application/vnd.space.document.space-note"),
            "md"
        );

        // Test common MIME types
        assert_eq!(get_resource_file_extension("image/png"), "png");
        assert_eq!(get_resource_file_extension("image/jpg"), "jpg");
        assert_eq!(get_resource_file_extension("text/plain"), "txt");
        assert_eq!(get_resource_file_extension("application/json"), "json");
        assert_eq!(get_resource_file_extension("text/markdown"), "md");

        // Test fallback behavior
        assert_eq!(get_resource_file_extension("unknown/type"), "type");
    }
}
