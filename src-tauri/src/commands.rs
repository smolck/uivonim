use tauri::{async_runtime::block_on, command};

use rmpv::Value as rmpvVal;

use serde::Serialize;
use serde_json::{json, map::Map};

#[command]
pub async fn your_face() -> String {
  // let paths = nvim().list_runtime_paths().await;
  format_args!("your face!").to_string()
}

type S<'a> = tauri::State<'a, crate::AppState>;

#[command]
pub fn attach_ui(state: S) {
  block_on(async {
    println!("Attaching UI!");
    let mut nvim = state.nvim.lock().await;
    nvim
      .ui_attach(
        80,
        80,
        &nvim_rs::UiAttachOptions::new()
          .set_linegrid_external(true)
          .set_rgb(true),
      )
      .await
      .expect("couldn't attach to UI!!!");
    println!("UI attached!");
  });
}

#[command]
pub fn get_highlight_by_name(state: S, name: &str, rgb: bool) -> Map<String, serde_json::Value> {
  block_on(async {
    let nvim = state.nvim.lock().await;
    let resp = nvim.get_hl_by_name(name, rgb).await;

    let mut ret = Map::new();
    if resp.is_ok() {
      for (k, v) in resp.unwrap().iter() {
        match v {
          rmpvVal::Integer(i) => {
            ret.insert(k.to_string(), json!(i.as_i64()));
          }
          rmpvVal::Boolean(b) => {
            ret.insert(k.to_string(), json!(b));
          }
          _ => unreachable!(),
        }
      }
    } else {
      // TODO(smolck): Error handling here?
      ret.insert("foreground".to_string(), json!(0));
      ret.insert("background".to_string(), json!(0));
    }

    ret
  })
}
