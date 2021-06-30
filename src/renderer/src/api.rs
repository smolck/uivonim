use seed::prelude::*;
use wasm_bindgen::prelude::*;

pub type RedrawEventHandler = Closure<dyn FnMut(JsValue)>;

#[derive(PartialEq, Eq, Hash)]
pub enum RedrawEvents {
    GridLine,
}

impl ToString for RedrawEvents {
    fn to_string(&self) -> String {
        use RedrawEvents::*;
        match self {
            GridLine => String::from("grid_line"),
        }
    }
}

mod local {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = ["window", "api"], js_name = "onRedrawEvent")]
        pub fn on_redraw_event(event_name: &str, cb: &crate::api::RedrawEventHandler);
    }
}

/// Returns closure that needs to be stored somewhere/can't go out of scope so it is available
/// for JS to call more than once
#[must_use]
pub fn on_redraw_event<F: 'static>(event: RedrawEvents, cb: F) -> RedrawEventHandler
where
    F: FnMut(JsValue),
{
    let closure = Closure::new(cb);

    local::on_redraw_event(&event.to_string(), &closure);

    closure
}
