mod api;
mod grid;
mod webgl;

use api::{RedrawEventHandler, RedrawEvents};
use seed::{prelude::*, *};
use std::collections::HashMap;
use web_sys::HtmlCanvasElement;

struct Model {
    handlers: HashMap<RedrawEvents, RedrawEventHandler>,
    canvas: ElRef<HtmlCanvasElement>,
    initialized: bool,
    grids: HashMap<i64, grid::Grid>,
}

impl Model {
    pub fn add_handler<F: 'static>(&mut self, evt: RedrawEvents, cb: F)
    where
        F: FnMut(JsValue),
    {
        // TODO(smolck): Should be fine just discarding this value . . . I think.
        let _ = self.handlers.insert(evt.clone(), api::on_redraw_event(evt, cb));
    }
}

fn init(_: Url, orders: &mut impl Orders<Msg>) -> Model {
    orders.after_next_render(|_| Msg::Rendered);

    let mut model = Model {
        handlers: HashMap::new(),
        canvas: ElRef::default(),
        grids: HashMap::new(),
        initialized: false,
    };

    model.add_handler(RedrawEvents::GridLine, |val| {});

    model
}

enum Msg {
    Rendered,
}

fn update(msg: Msg, model: &mut Model, orders: &mut impl Orders<Msg>) {
    match msg {
        /*Msg::RedrawMsg(redraw_msg) => redraw::update(
            redraw_msg,
            &mut model.redraw_model,
            &mut orders.proxy(Msg::RedrawMsg),
        ),*/
        Msg::Rendered => {
            // let canvas = model.canvas().get().unwrap();
        }
    }
}

fn view(model: &Model) -> Node<Msg> {
    div![canvas![el_ref(&model.canvas), attrs![]],]
}

#[wasm_bindgen(start)]
pub fn start() {
    App::start("app", init, update, view);
}
