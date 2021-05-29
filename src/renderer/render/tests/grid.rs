use render::grid::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

use js_sys::Reflect;

#[wasm_bindgen_test]
fn grid_works() {
    let mut grid = Grid::new();
    grid.resize(10, 10);
    grid.assert_width(10);
    grid.assert_height(10);

    let mut cond = true;
    for row in grid.rows() {
        for cell in row {
            cond = cond && *cell == Default::default();
        }
    }
    assert!(cond);

    let arr = js_sys::Array::new_with_length(10);
    arr.fill(&js_sys::Array::of1(&JsValue::from("b")), 0, 10);
    grid.handle_single_grid_line(0, 0, &arr);
    let cell_expected = Cell {
        hl_id: 0,
        char: 'b',
    };
    assert!(grid.rows()[0] == [cell_expected].repeat(10));

    grid.move_region_down(2, 0, 2);
    assert!(grid.rows()[0] == [Cell::default()].repeat(10));
    assert!(grid.rows()[2] == [cell_expected].repeat(10));
}
