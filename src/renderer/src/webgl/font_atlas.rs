use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast as _;
use web_sys::{CanvasRenderingContext2d, Document as HtmlDocument, HtmlCanvasElement as Canvas};

use luminance::{
    backend::texture::Texture as TextureBackend,
    context::GraphicsContext,
    pixel::NormRGB8UI,
    texture::{Dim2, GenMipmaps, MagFilter, MinFilter, Sampler, Texture},
};

use std::collections::HashMap;

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct AtlasCharBounds {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}

#[derive(Clone, PartialEq, Debug)]
pub struct AtlasChar {
    pub char: char,
    // unicode: Vec<u8>,
    pub is_double_width: bool,
    pub bounds: AtlasCharBounds,
}

pub struct FontAtlas {
    canvas: Canvas,
    ctx: CanvasRenderingContext2d,
    chars_in_font_atlas: HashMap<char, AtlasChar>,
    chars_queue: HashMap<char, AtlasChar>,
    next_bounds: Option<AtlasCharBounds>,
    pub char_width: f32,
    pub char_height: f32,
    pub canvas_width: u32,
    pub canvas_height: u32,
    font: String,
}

impl FontAtlas {
    pub fn new(font: &str, canvas_id: &str, canvas_width: u32, canvas_height: u32) -> FontAtlas {
        let win = web_sys::window().unwrap();
        let canvas = win
            .document()
            .unwrap()
            .unchecked_into::<HtmlDocument>()
            .create_element("canvas")
            .unwrap()
            .unchecked_into::<Canvas>();
        canvas.set_id(canvas_id);

        let ctx = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .unchecked_into::<CanvasRenderingContext2d>();
        let chars_in_font_atlas = HashMap::new();
        let chars_queue = HashMap::new();

        // TODO(smolck): These need to be based on the font, just hardcoded for now to something
        // arbitrary.
        let char_width = 10. / canvas_width as f32; // Normalize -> TODO(smolck)
        let char_height = 20. / canvas_height as f32; // Normalize -> TODO(smolck)

        let px_ratio = win.device_pixel_ratio();
        canvas.set_height((canvas_height as f64 * px_ratio) as u32);
        canvas.set_width((canvas_width as f64 * px_ratio) as u32);

        FontAtlas {
            canvas,
            canvas_width,
            canvas_height,
            ctx,
            chars_in_font_atlas,
            chars_queue,
            char_width,
            char_height,
            next_bounds: None,
            font: font.to_owned(),
        }
    }

    pub fn get_char(&mut self, char: char, is_double_width: bool) -> AtlasChar {
        // TODO(smolck): Perf of copies/clones and stuff.
        if let Some(c) = self.chars_in_font_atlas.get(&char) {
            return c.clone();
        }

        if let Some(c) = self.chars_queue.get(&char) {
            return c.clone();
        }

        // Char isn't in font_atlas, so let's add it.
        if let Some(bounds) = self.next_bounds {
            // TODO(smolck): `to_owned()` perf?

            // Just another char to add to the font atlas.
            let new_char = AtlasChar {
                char: char.to_owned(),
                is_double_width,
                bounds,
            };

            self.chars_queue.insert(char.to_owned(), new_char.clone());
            self.update_next_bounds(is_double_width);

            new_char
        } else {
            // First char in the font_atlas.
            let width = if is_double_width {
                self.char_width * 2.
            } else {
                self.char_width
            };
            let bounds = AtlasCharBounds {
                left: 0.,
                right: width,
                top: 0.,
                bottom: self.char_height,
            };

            // Have to add the first bounds to next_bounds in order for
            // self.update_next_bounds() to work and not fail.
            self.next_bounds = Some(bounds);
            self.update_next_bounds(is_double_width);

            let new_char = AtlasChar {
                char: char.to_owned(),
                is_double_width,
                bounds,
            };

            self.chars_queue
                .insert(char.to_owned(), new_char.to_owned());

            new_char
        }
    }

    fn regen_from_chars(&self, chars: &HashMap<char, AtlasChar>) {
        let px_ratio = web_sys::window().unwrap().device_pixel_ratio();

        // Regen font atlas with new chars from queue
        for (char, atlas_char) in chars.iter() {
            self.ctx.set_image_smoothing_enabled(true);
            self.ctx.set_font(&self.font);
            self.ctx.scale(px_ratio, px_ratio).unwrap();
            self.ctx.set_text_baseline("top");
            self.ctx.set_fill_style(&JsValue::from_str("white"));

            let char_width = (if atlas_char.is_double_width {
                self.char_width * 2.
            } else {
                self.char_width
            } * self.canvas_width as f32)
                .into();

            // De-normalize the bounds for the x, y coords.
            let x = atlas_char.bounds.left as f64 * self.canvas_width as f64;
            let y = atlas_char.bounds.bottom as f64 * self.canvas_height as f64;
            web_sys::console::log_1(&JsValue::from_str(&format!(
                "x: {}, y: {}, char_width: {}, char: {}, selfwidth: {}",
                x, y, char_width, char, self.char_width,
            )));
            self.ctx.save();
            self.ctx.begin_path();
            self.ctx.rect(x, y, char_width, self.char_height.into());
            self.ctx
                .fill_text_with_max_width(&char.to_string(), x, y, char_width)
                .unwrap();
            self.ctx.restore();
        }
    }

    pub fn maybe_regen(&mut self) -> bool {
        if self.chars_queue.len() > 0 {
            self.regen_from_chars(&self.chars_queue);

            // Add queued to chars in font atlas
            self.chars_in_font_atlas.extend(self.chars_queue.to_owned());

            // Clear queue
            self.chars_queue.clear();

            true
        } else {
            false
        }
    }

    pub fn force_regen(&mut self) {
        self.regen_from_chars(&self.chars_in_font_atlas);
    }

    fn update_next_bounds(&mut self, double_width: bool) {
        if let Some(old_bounds) = self.next_bounds {
            // Multiply by canvas width to normalize bounds
            // TODO(smolck): ?
            let move_down = (old_bounds.right + self.char_width) * self.canvas_width as f32
                >= self.canvas_width as f32;

            let char_width = if double_width {
                self.char_width * 2.
            } else {
                self.char_width
            };

            self.next_bounds = Some(if move_down {
                AtlasCharBounds {
                    left: 0.,
                    right: char_width,
                    top: old_bounds.top + self.char_height,
                    bottom: old_bounds.bottom + self.char_height,
                }
            } else {
                AtlasCharBounds {
                    left: old_bounds.left + char_width,
                    right: old_bounds.right + char_width,
                    top: old_bounds.top,
                    bottom: old_bounds.bottom,
                }
            });
        } else {
            println!("Tried to update FontAtlas.next_bounds that was None; shouldn't happen.");
            // TODO(smolck): Should I do this, also can I put the above message in this.
            unreachable!();
        }
    }

    pub fn to_tex<B>(&self, context: &mut B) -> Texture<B::Backend, Dim2, NormRGB8UI>
    where
        B: GraphicsContext,
        B::Backend: TextureBackend<Dim2, NormRGB8UI>,
    {
        let mut sampler = Sampler::default();
        sampler.mag_filter = MagFilter::Nearest;
        sampler.min_filter = MinFilter::Nearest;

        let image_data: Vec<u8> = self
            .ctx
            .get_image_data(0., 0., self.canvas_width as f64, self.canvas_height as f64)
            .unwrap()
            .data()
            .to_vec();

        let mut tex = Texture::new(context, [self.canvas_width, self.canvas_height], 0, sampler)
            .expect("luminance texture creation");

        tex.upload_raw(GenMipmaps::No, &image_data).unwrap();

        tex
    }
}

/// For tests.
impl FontAtlas {
    pub fn assert_next_bounds_eq(&self, expected: AtlasCharBounds) {
        assert_eq!(self.next_bounds, Some(expected));
    }

    pub fn assert_queue_contains(&self, chars: Vec<char>) {
        // TODO(smolck)
        web_sys::console::log_1(&JsValue::from_str(&format!(
            "[assert_queue_contains]: Chars queue has: {:?}",
            self.chars_queue.keys()
        )));
        for char in chars.iter() {
            assert!(self.chars_queue.contains_key(char));
        }
    }

    pub fn assert_queue_empty(&self) {
        web_sys::console::log_1(&JsValue::from_str(&format!(
            "[assert_queue_empty]: Chars queue has: {:?}",
            self.chars_queue.keys()
        )));
        assert!(self.chars_queue.is_empty());
    }

    pub fn append_canvas_to_document_body(&self) {
        let win = web_sys::window().unwrap();
        let document = win.document().unwrap().unchecked_into::<HtmlDocument>();

        document.body().unwrap().append_child(&self.canvas).unwrap();
    }
}
