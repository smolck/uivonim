use core::slice::SlicePattern;
use std::path::Path;

use nvim_rs::error::CallError;
use tauri::{async_runtime::block_on, command};

use rmpv::Value as rmpvVal;

use serde::Serialize;
use serde_json::{json, map::Map};

use futures::stream::{self, StreamExt};

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
          .set_rgb(true)
          .set_multigrid_external(true)
          .set_cmdline_external(true)
          .set_popupmenu_external(true)
          .set_wildmenu_external(true),
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

#[command]
pub fn nvim_resize(state: S, cols: i64, rows: i64) {
  block_on(async {
    let nvim = state.nvim.lock().await;
    match nvim.ui_try_resize(cols, rows).await {
      Ok(_) => {}
      Err(e) => {
        eprintln!("error executing nvim_resize: {}", e);
      }
    }
  });
}

#[command]
pub fn nvim_resize_grid(state: S, grid: i64, cols: i64, rows: i64) {
  block_on(async {
    let nvim = state.nvim.lock().await;

    match nvim.ui_try_resize_grid(grid, cols, rows).await {
      Ok(_) => {}
      Err(e) => {
        eprintln!("error executing nvim_resize_grid: {}", e);
      }
    }
  });
}

#[command]
pub fn nvim_command(state: S, cmd: &str) {
  block_on(async {
    let nvim = state.nvim.lock().await;

    match nvim.command(cmd).await {
      Ok(_) => {}
      Err(e) => {
        eprintln!("error executing nvim_command: {}", e);
      }
    }
  });
}

#[command]
pub fn expand(state: S, thing: &str) -> Result<String, String> {
  block_on(async {
    let nvim = state.nvim.lock().await;
    nvim
      .call_function("expand", vec![rmpvVal::from(thing)])
      .await
  })
  .map(|v| v.as_str().unwrap().to_string())
  .map_err(|err| format!("{}", err))
}

#[derive(Serialize)]
pub struct BufferInfo {
  dir: String,
  name: String,
  base: String,
  terminal: bool,
  modified: bool,
  duplicate: bool,
}

#[command]
pub fn get_buffer_info(state: S) -> Result<Vec<BufferInfo>, String> {
  (block_on(async {
    let nvim = state.nvim.lock().await;
    let buffers = nvim.list_bufs().await?;

    // TODO(smolck): Is this really the bufid/bufnr?

    let curr_buf_id = nvim.get_current_buf().await?;
    let curr_buf_id =
      rmpv::decode::read_value(&mut curr_buf_id.get_value().as_ext().unwrap().1.as_slice())
        .unwrap()
        .as_i64()
        .unwrap();

    Ok(
      stream::iter(buffers)
        .filter_map(|b: nvim_rs::Buffer<_>| async move {
          let is_current =
            rmpv::decode::read_value(&mut b.get_value().as_ext().unwrap().1.as_slice())
              .unwrap()
              .as_i64()
              .unwrap()
              == curr_buf_id;
          if !b.get_option("buflisted").await.unwrap().as_bool().unwrap() && is_current {
            None
          } else {
            let name = b.get_name().await.unwrap();
            let path = Path::new(&name);

            Some(BufferInfo {
              name: name.clone(),
              modified: b.get_option("modified").await.unwrap().as_bool().unwrap(),
              terminal: b.get_option("buftype").await.unwrap().as_str().unwrap() == "terminal",
              // TODO(smolck): to_str().unwrap().to_string() . . . seriously?
              base: path
                .file_name()
                .expect("a path should have a last part always, right?")
                .to_str()
                .unwrap()
                .to_string(),
              // TODO(smolck): see `simplifyPath` from src/common/utils.ts, Rust equivalent is . . . ?
              // Is it even necessary?
              dir: path
                .parent()
                .expect("a path should always have a parent?")
                .to_str()
                .unwrap()
                .to_string(),
              // TODO(smolck): what's up with all this duplicate stuff? what does it even do?
              // In the old code anyways . . . here I'm just gonna set it to false for now I guess . . .
              duplicate: false,
            })
          }
        })
        .collect::<Vec<BufferInfo>>()
        .await,
    )
    /*
    return bufInfo
      .filter((m) => m.listed && !m.current)
      .map(({ name, modified, terminal }) => ({
        name,
        modified,
        terminal,
        base: basename(name),
        dir: simplifyPath(dirname(name), state.cwd),
      }))
      .map((m, ix, arr) => ({
        ...m,
        duplicate: arr.some((n, ixf) => ixf !== ix && n.base === m.base),
      }))
      .map((m) => ({ ...m, name: m.duplicate ? `${m.dir}/${m.base}` : m.base }))*/
  }))
  .map_err(|err: Box<CallError>| format!("{}", err))
}
