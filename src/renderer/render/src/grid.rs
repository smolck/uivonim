use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast as _;

use crate::font_atlas::{AtlasCharBounds, FontAtlas};
use crate::webgl::types::{Vertex, VertexPosition, VertexTexCoords};

use js_sys::Reflect;

// TODO(smolck): usize okay for repeat or different type like u32?
/// (text, hl_id, repeat)
pub struct GridLineCell(pub char, pub Option<i32>, pub Option<usize>);
pub struct GridLineSingle {
    pub grid: i64,
    // TODO(smolck): Types . . .
    pub row: usize,
    pub col_start: usize,
    pub cells: Vec<GridLineCell>,
}

#[derive(PartialEq, Clone, Copy)]
pub struct Cell {
    pub hl_id: i64,
    pub char: char,
}

impl Default for Cell {
    fn default() -> Cell {
        Cell {
            hl_id: 0,
            char: ' ',
        }
    }
}

impl Cell {
    // https://stackoverflow.com/a/57693847
    pub fn extract(&mut self) -> Cell {
        std::mem::replace(self, Default::default())
    }

    // TODO(smolck): Passing in x, y, char_width, char_height do that or not?
    // Also, assuming these `f32`s are normalized atm.
    // TBH might not even keep this function here . . .
    pub fn to_vertices(
        &self,
        x: f32,
        y: f32,
        char_width: f32,
        char_height: f32,
        font_atlas: &mut FontAtlas,
    ) -> Vec<Vertex> {
        // TODO(smolck): Double width stuff??
        let atlas_char = font_atlas.get_char(self.char, false);
        let AtlasCharBounds {
            left: l,
            right: r,
            top: t,
            bottom: b,
        } = atlas_char.bounds;

        let x_end = x;
        let x_start = x - char_width;

        let y_end = y + char_height;

        vec![
            // Left/top tri of quad
            Vertex::new(
                // Top right vertex
                VertexPosition::new([x_end, y]),
                VertexTexCoords::new([r, t]),
            ),
            Vertex::new(
                // Left top vertex
                VertexPosition::new([x_start, y]),
                VertexTexCoords::new([l, t]),
            ),
            Vertex::new(
                // Bottom left vertex
                VertexPosition::new([x_start, y_end]),
                VertexTexCoords::new([l, b]),
            ),
            // Right/bottom tri of quad
            Vertex::new(
                // Bottom left vertex
                VertexPosition::new([x_start, y_end]),
                VertexTexCoords::new([l, b]),
            ),
            Vertex::new(
                // Bottom right vertex
                VertexPosition::new([x_end, y_end]),
                VertexTexCoords::new([r, b]),
            ),
            Vertex::new(
                // Top vertex
                VertexPosition::new([x_end, y]),
                VertexTexCoords::new([r, t]),
            ),
        ]
    }
}

pub struct Grid {
    rows: Vec<Vec<Cell>>,
    width: u32,
    height: u32,
    vertices_cache: Option<Vec<Vertex>>,
}

impl Grid {
    pub fn new() -> Grid {
        Grid {
            rows: vec![],
            width: 0,
            height: 0,
            vertices_cache: None,
        }
    }

    pub fn new_with_dimensions(width: u32, height: u32) -> Grid {
        Grid {
            rows: Vec::with_capacity(height as usize),
            vertices_cache: None,
            width,
            height,
        }
    }

    pub fn to_vertices(
        &mut self,
        font_atlas: &mut FontAtlas,
        width: f32,
        height: f32,
    ) -> &Vec<Vertex> {
        if self.vertices_cache.is_none() {
            // TODO(smolck): This needs to be based on font, for now just what the values
            // hard-coded in the font atlas code
            let (char_width, char_height): (f32, f32) = (10., 20.); // in px

            let starting_x = 0.;
            let starting_y = 0.;
            let mut vertices = vec![];

            // TODO(smolck): This *has* to be slow, right?
            for (i, row) in self.rows.iter().enumerate() {
                for (j, cell) in row.iter().enumerate() {
                    let y = starting_y + (i as f32 * char_height);
                    let x = starting_x + (j as f32 * char_width);
                    vertices.extend(cell.to_vertices(
                        x / width,
                        y / height,
                        char_width / width,
                        char_height / height,
                        font_atlas,
                    ));
                }
            }

            self.vertices_cache = Some(vertices);
            &self.vertices_cache.as_ref().unwrap()
        } else {
            &self.vertices_cache.as_ref().unwrap()
        }
    }

    // TODO(smolck): Pub for tests but . . . yeah
    pub fn handle_single_grid_line(
        &mut self,
        row: u32,
        col_start: u32,
        cells: &JsValue,
    ) -> Result<(), JsValue> {
        let mut new_cells = Vec::with_capacity((self.width - col_start) as usize);
        // each cell should be [text(, hl_id, repeat)], see `:help ui-events` and help for
        // `grid_line`
        for cell in js_sys::try_iter(cells)?.expect("hey this should be iterable please") {
            let cell = cell?;

            let mut hl_id = 0;
            if let Ok(hl) = Reflect::get(&cell, &JsValue::from(1)) {
                // TODO(smolck): Is this really the only way to go from JsValue -> integer?
                hl_id = hl.as_f64().unwrap() as i64;
            }

            let cell_that_isnt_js = Cell {
                hl_id,
                char: Reflect::get(&cell, &JsValue::from(0))
                    .unwrap()
                    // Look it's fine, just trust me ok?
                    .as_string()
                    .unwrap()
                    .parse::<char>()
                    .unwrap(),
            };
            if let Ok(repeat) = Reflect::get(&cell, &JsValue::from(2)) {
                for _ in 0..repeat.as_f64().unwrap() as usize {
                    new_cells.push(cell_that_isnt_js);
                }
            } else {
                new_cells.push(cell_that_isnt_js);
            }
        }

        self.rows[row as usize][(col_start as usize)..].swap_with_slice(new_cells.as_mut_slice());

        // invalidate cache
        // TODO(smolck): Should probably be smart about this, since I feel like this'll be too slow.
        //  Keep information around about where in `vertices_cache` each char's vertices lives, and then
        // only update the ones that have changed between grid_line events.
        self.vertices_cache = None;

        Ok(())
    }

    // TODO(smolck): Type of `rows` and `cols`?
    pub fn resize(&mut self, rows: usize, cols: usize) {
        if rows > self.rows.len() {
            self.rows.resize_with(rows, Default::default);
        }

        if cols > self.width as usize {
            for row in self.rows.iter_mut() {
                row.resize_with(cols, Default::default);
            }
        }

        self.height = rows as u32;
        self.width = cols as u32;
    }

    pub fn clear(&mut self) {
        for row in self.rows.iter_mut() {
            for cell in row.iter_mut() {
                *cell = Default::default();
            }
        }
    }

    // TODO(smolck): Types of `row` and `col`?
    pub fn get_cell(&self, row: usize, col: usize) -> &Cell {
        &self.rows[row][col]
    }

    pub fn get_line(&self, row: usize) -> &Vec<Cell> {
        &self.rows[row]
    }

    pub fn move_region_up(&mut self, lines: usize, top: usize, bottom: usize) {
        let mut row = top + lines;
        let offset = lines;

        // TODO(smolck): bottom + 1 is right? . . .
        while row <= bottom + 1 {
            for i in 0..self.width {
                self.rows[row - offset][i as usize] = self.rows[row][i as usize].extract();
            }

            row += 1;
        }
    }

    pub fn move_region_down(&mut self, lines: usize, top: usize, bottom: usize) {
        let start_row = top;
        let offset = lines;
        // TODO(smolck): bottom + 1?
        let mut end_row = (bottom + 1) + offset;

        while end_row >= start_row {
            for i in 0..self.width {
                self.rows[end_row + offset][i as usize] = self.rows[end_row][i as usize].extract();
            }

            // If `top` is 0, then since the condition is end_row is greater than
            // or *equal* to start_row, without this break we get a 0 - 1, which
            // won't work with `usize`.
            //
            // TODO(smolck): why tho
            if end_row == 0 {
                break;
            }

            end_row -= 1;
        }
    }
}

// For tests
impl Grid {
    pub fn assert_width(&self, expected: u32) {
        assert_eq!(self.width, expected);
    }

    pub fn assert_height(&self, expected: u32) {
        assert_eq!(self.height, expected);
    }

    pub fn rows(&self) -> &Vec<Vec<Cell>> {
        &self.rows
    }
}
