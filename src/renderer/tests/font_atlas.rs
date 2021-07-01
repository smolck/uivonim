use wasm_bindgen_test::*;
wasm_bindgen_test_configure!(run_in_browser);
use wasm_bindgen::prelude::*;

use renderer::webgl::font_atlas::*;

#[wasm_bindgen_test]
fn font_atlas_works() {
    let mut font_atlas = FontAtlas::new("16px sans-serif", "da-font-atlas", 100, 100);
    font_atlas.append_canvas_to_document_body();
    let char = font_atlas.get_char('😅', true);

    let expected_initial_bounds = AtlasCharBounds {
        left: font_atlas.char_width * 2.,
        right: (font_atlas.char_width * 2.) * 2.,
        top: 0.,
        bottom: font_atlas.char_height,
    };
    font_atlas.assert_next_bounds_eq(expected_initial_bounds);
    assert_eq!(char.char, '😅');

    font_atlas.get_char('H', false);
    font_atlas.get_char('😂', true);
    font_atlas.get_char('l', false);
    // TODO(smolck): Looking at the canvas it seems the bounds might be a bit too much. Not sure
    // how big of a deal it is, but just a note.
    font_atlas.get_char('试', true);

    font_atlas.assert_queue_contains(vec!['😅', 'H', '😂', 'l', '试']);
    font_atlas.assert_next_bounds_eq(AtlasCharBounds {
        left: expected_initial_bounds.left +
            (font_atlas.char_width * 2.) + // Two single width chars ('H' && 'l')
            (font_atlas.char_width * 2.) * 2., // Two double width chars ('😂' and '试')
        right: expected_initial_bounds.right +
            (font_atlas.char_width * 2.) + // Same as above
            (font_atlas.char_width * 2.) * 2., // Same as above
        top: 0.,
        bottom: font_atlas.char_height,
    });

    assert!(font_atlas.maybe_regen(), true);
    font_atlas.assert_queue_empty();
}
