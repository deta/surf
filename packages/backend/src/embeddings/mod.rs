pub mod chunking;

const _MODULE_PREFIX: &str = "embeddings";

#[allow(dead_code)]
fn cosine_dist_f32(vec_a: &[f32], vec_b: &[f32], vec_size: &usize) -> f32 {
    let mut a_dot_b = 0.0;
    let mut a_mag = 0.0;
    let mut b_mag = 0.0;

    for i in 0..*vec_size {
        a_dot_b += vec_a[i] * vec_b[i];
        a_mag += vec_a[i] * vec_a[i];
        b_mag += vec_b[i] * vec_b[i];
    }

    1.0 - (a_dot_b / (a_mag.sqrt() * b_mag.sqrt()))
}
