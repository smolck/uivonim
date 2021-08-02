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
          .set_hlstate_external(true)
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

static MODIFIERS: &[&str] = &["Alt", "Shift", "Meta", "Control"];

async fn send_to_nvim(nvim: &crate::neovim_handler::Nvim, input: &str) {
  let input = if input.len() == 1 {
    // Necessary because of "<" being "special," see `:help nvim_input()`
    input.replace("<", "<LT>")
  } else {
    input.to_string()
  };

  // TODO(smolck): Global shortcuts
  // if (globalShortcuts.has(inputKeys)) return globalShortcuts.get(inputKeys)!()

  // TODO(smolck): This todo is from the TS codebase, so . . . yeah
  // TODO: this might need more attention. i think s-space can be a valid
  // vim keybind. s-space was causing issues in terminal mode, sending weird
  // term esc char.
  match input.as_str() {
    "<S-Space>" => nvim
      .input("<space>")
      .await
      .expect("couldn't send nvim input"),
    // TODO(smolck): From previous codebase, wat:
    // if (inputKeys.length > 1 && !inputKeys.startsWith('<')) {
    //   return inputKeys.split('').forEach((k: string) => nvimInput(k))
    // }

    /*x if x.len() > 1 && x.starts_with("<") => {
      stream::iter(x.chars()).for_each_concurrent(None, |c| async {
        nvim.input()
      }).await;
    }*/
    // x if x.to_lowercase() == "<esc>"
    x => nvim.input(x).await.expect("couldn't send nvim input"),
  };
}

#[command]
pub fn document_on_input(state: S, data: &str) {
  block_on(async {
    let mut input_state = state.input_state.lock().await;

    // TODO(smolck): Maybe structure this w/out early returns so it's more clear
    // what's going on.
    if cfg!(target_os = "macos") {
      if !input_state.previous_key_was_dead && input_state.key_is_dead {
        input_state.key_is_dead = false;
        input_state.previous_key_was_dead = true;
        return;
      }
    }

    if !input_state.window_has_focus || !input_state.is_capturing {
      return;
    }

    if input_state.send_input_to_vim {
      let nvim = state.nvim.lock().await;
      send_to_nvim(&nvim, data).await;
    }
  })
}

#[command]
pub fn document_on_keydown(
  state: S,
  key: &str,
  ctrl_key: bool,
  meta_key: bool,
  alt_key: bool,
  shift_key: bool,
) {
  block_on(async {
    let mut input_state = state.input_state.lock().await;

    if !input_state.window_has_focus || !input_state.is_capturing {
      return;
    }

    let is_not_char = {
      if key.len() == 1 && !ctrl_key && !meta_key && !alt_key && !shift_key {
        false
      }
      // Why this monstrosity exists:
      // If on Linux/Windows, and the key sequence is typed with alt-shift or alt
      // (and no other modifers), send to Neovim (for alt-shift and alt mappings).
      else if !cfg!(target_os = "macos")
        && ((shift_key && alt_key) || alt_key)
        && key.len() == 1
        && !ctrl_key
        && !meta_key
      {
        true
      }
      // Pass on modified keys (like alt-7, but not ctrl, which is used in mappings
      else if (shift_key || meta_key || alt_key) && !ctrl_key && key.len() == 1 {
        false
      } else {
        true
      }
    };

    // TODO(smolck): For some reason on MacOS when a dead key is pressed, even if it
    // isn't actually typed, it's received by the `oninput` handler, which causes an
    // issue where it's sent to Neovim when it shouldn't be. To fix that, we make
    // sure that a dead key is only ever sent to Neovim if it's typed twice in a row,
    // which is the way it should be.
    let workaround_for_dead_key_being_pressed_twice_in_a_row_on_macos = if cfg!(target_os = "macos")
    {
      // TODO(smolck): This logic feels weird/can be simplified I think.
      let key_is_dead = key == "Dead";

      if key_is_dead && !input_state.previous_key_was_dead {
        input_state.key_is_dead = true;
        input_state.previous_key_was_dead = false;
        false
      } else {
        if input_state.previous_key_was_dead {
          input_state.previous_key_was_dead = false;
          input_state.key_is_dead = key_is_dead;
        }

        true
      }
    } else {
      true
    };

    if is_not_char && workaround_for_dead_key_being_pressed_twice_in_a_row_on_macos {
      let input_empty_mod_bypassed = if MODIFIERS.contains(&key) { "" } else { key };
      let mods = {
        let mut mods = vec![];
        let only_shift = shift_key && !ctrl_key && !meta_key && !alt_key;
        let not_cmd_or_ctrl = !meta_key && !ctrl_key;
        // TODO(smolck): From TS codebase; why the heck does this exist/what does it do?
        let macos_unicode = (cfg!(target_os = "macos") && alt_key && not_cmd_or_ctrl)
          || (cfg!(target_os = "macos") && alt_key && shift_key && not_cmd_or_ctrl);

        if (only_shift && key.is_ascii() && key.len() == 1) || macos_unicode {
          mods
        } else {
          if ctrl_key {
            mods.push("C");
          }
          if shift_key {
            mods.push("S");
          }
          if meta_key {
            mods.push("D");
          }
          if alt_key {
            mods.push("A");
          }

          mods
        }
      }
      .join("-");
      let nvim_key = match input_empty_mod_bypassed {
        "Backspace" => "BS",
        "<" => "LT",
        "Escape" => "Esc",
        "Delete" => "Del",
        " " => "Space",
        "ArrowUp" => "Up",
        "ArrowDown" => "Down",
        "ArrowLeft" => "Left",
        "ArrowRight" => "Right",
        _ => input_empty_mod_bypassed,
      };
      // TODO(smolck): What did this do???? (from TS codebase)
      // const wrapKey = (key: string): string =>
      // key.length > 1 && isUpper(key[0]) ? `<${key}>` : key

      let input = if mods.len() != 0 {
        format!("<{}-{}>", mods, nvim_key)
      } else {
        format!("<{}>", nvim_key)
      };

      if input_state.send_input_to_vim && !nvim_key.is_empty() {
        state
          .nvim
          .lock()
          .await
          .input(&input)
          .await
          .expect("couldn't send input to nvim");
      }
    }
  })
}

#[command]
pub fn get_font_bytes(font_name: &str) -> Result<Vec<u8>, String> {
  use font_kit::{handle::Handle, source::SystemSource};

  if let Handle::Memory { bytes, .. } = SystemSource::new()
    .select_by_postscript_name(&font_name)
    .map_err(|err| format!("selection error: {}", err))?
    .load()
    .map_err(|err| format!("loading error: {}", err))?
    .handle()
    .expect("need a handle here")
  {
    Ok(bytes.to_vec())
  } else {
    Err(format!("couldn't load the font {}", font_name))
  }
}
