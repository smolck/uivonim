#![feature(slice_pattern)] // TODO(smolck): umm . . . why tho
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod commands;
mod helpers;
mod neovim_handler;

use futures::lock::Mutex;
use neovim_handler::NeovimHandler;
use std::{collections::HashSet, sync::Arc};

pub struct InputState {
  previous_key_was_dead: bool,
  key_is_dead: bool,
  is_capturing: bool,
  window_has_focus: bool,
  send_input_to_vim: bool,

  // TODO(smolck): Global shortcuts w/defaults and all that
  global_shortcuts: HashSet<String>,
  one_time_use_shortcuts: HashSet<String>,
}

pub struct AppState {
  nvim: Arc<Mutex<neovim_handler::Nvim>>,
  input_state: Arc<Mutex<InputState>>,
}

#[tokio::main]
async fn main() {
  let (window_ref, nvim) = NeovimHandler::start_new().await;

  nvim.subscribe("uivonim").await.unwrap();
  nvim.subscribe("uivonim-autocmd").await.unwrap();
  nvim.subscribe("uivonim-state").await.unwrap();

  let nvim = Arc::new(Mutex::new(nvim));

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::quit,
      commands::attach_ui,
      commands::get_highlight_by_name,
      commands::nvim_resize,
      commands::nvim_resize_grid,
      commands::nvim_command,
      commands::get_buffer_info,
      commands::expand,
      commands::document_on_input,
      commands::document_on_keydown,
      commands::get_font_bytes,
      commands::input_blur,
      commands::input_focus,
      commands::register_one_time_use_shortcuts,
      commands::steal_input,
      commands::restore_input,
      commands::luaeval,
      commands::nvim_jump_to,
    ])
    .manage(AppState {
      nvim,
      input_state: Arc::new(Mutex::new(InputState {
        previous_key_was_dead: false,
        key_is_dead: false,
        is_capturing: true,
        window_has_focus: true,
        send_input_to_vim: true,
        global_shortcuts: HashSet::new(),
        one_time_use_shortcuts: HashSet::new(),
      })),
    })
    .on_page_load(move |win, _| {
      let win_clone = win.clone();
      let re = window_ref.clone();
      tauri::async_runtime::spawn(async move {
        let mut win = re.lock().await;
        *win = Some(win_clone);
      });
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
