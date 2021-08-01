#![feature(slice_pattern)] // TODO(smolck): umm . . . why tho
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod commands;
mod neovim_handler;

use futures::lock::Mutex;
use neovim_handler::NeovimHandler;
use std::sync::Arc;

pub struct InputState {
  previous_key_was_dead: bool,
  key_is_dead: bool,
  is_capturing: bool,
  window_has_focus: bool,
  send_input_to_vim: bool,
}

pub struct AppState {
  nvim: Arc<Mutex<neovim_handler::Nvim>>,
  input_state: Arc<Mutex<InputState>>,
}

#[tokio::main]
async fn main() {
  let (window_ref, nvim) = NeovimHandler::start_new().await;
  let nvim = Arc::new(Mutex::new(nvim));

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::your_face,
      commands::attach_ui,
      commands::get_highlight_by_name,
      commands::nvim_resize,
      commands::nvim_resize_grid,
      commands::nvim_command,
      commands::get_buffer_info,
      commands::expand,
      commands::document_on_input,
      commands::document_on_keydown,
    ])
    .manage(AppState {
      nvim,
      input_state: Arc::new(Mutex::new(InputState {
        previous_key_was_dead: false,
        key_is_dead: false,
        is_capturing: true,
        window_has_focus: true,
        send_input_to_vim: true,
      })),
    })
    .on_page_load(move |win, _| {
      let win_clone = win.clone();
      tauri::async_runtime::block_on(async {
        let mut window_ref = window_ref.lock().await;
        *window_ref = Some(win_clone);
      });
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
