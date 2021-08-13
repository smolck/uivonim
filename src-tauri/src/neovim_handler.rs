use async_trait::async_trait;
use core::slice::SlicePattern;
use nvim_rs::{compat::tokio::Compat, create::tokio as create, Handler, Neovim};
use rmpv::Value as NvimValue;

use serde_json::{json, Value as JsonValue};

use tauri::async_runtime::spawn;

use futures::lock::Mutex;
use std::{collections::HashMap, sync::Arc};

use tokio::process::{ChildStdin, Command};

pub type Nvim = Neovim<Compat<ChildStdin>>;

macro_rules! concat_command_completions {
    ( $last:expr, $( $thing:expr ),+) => {
      concat!($($thing, "\\n"),+, $last);
    };
}

/// Update this as part of adding a new command (e.g. :Uivonim some-new-thing)
static COMMAND_COMPLETIONS: &str =
  concat_command_completions!("pick-color", "nc", "buffers", "explorer");

async fn new_nvim_child_cmd(
  handler: NeovimHandler,
) -> (
  Nvim,
  tokio::task::JoinHandle<Result<(), Box<nvim_rs::error::LoopError>>>,
  tokio::process::Child,
) {
  use std::{fs::canonicalize, path::PathBuf};

  // TODO(smolck): Make this work (`cargo run`) from every dir?
  let runtime_dir =
    canonicalize(PathBuf::from("../runtime")).expect("this should work, getting the runtime dir");
  let runtime_dir = runtime_dir
    .to_str()
    .expect("runtime dir path is valid utf8");

  create::new_child_cmd(
    Command::new("nvim").args(&[
      "--cmd",
      &format!(
        "let $PATH .= ':{runtime_dir}/{platform}' | let &runtimepath .= ',{runtime_dir}'",
        runtime_dir = runtime_dir,
        platform = std::env::consts::OS
      ),
      "--cmd",
      "com! -nargs=+ -range -complete=custom,UivonimCmdCompletions Uivonim call Uivonim(<f-args>)",
      "--cmd",
      &format!("source {}/uivonim.vim", runtime_dir),
      "--cmd",
      // Completion for commands like `nc` when doing e.g. `:Uivonim <tab>`
      &format!("lua vim.g.uvn_cmd_completions = '{}'", COMMAND_COMPLETIONS),
      "--embed",
    ]),
    handler,
  )
  .await
  .expect("error creating new child cmd")
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct ModeInfo {
  pub blinkoff: Option<i64>,
  pub blinkon: Option<i64>,
  pub blinkwait: Option<i64>,
  pub cell_percentage: Option<i64>,
  pub cursor_shape: Option<String>,
  pub attr_id: Option<i64>,
  pub attr_id_lm: Option<i64>,
  pub hl_id: Option<i64>,
  pub id_lm: Option<i64>,
  pub mouse_shape: Option<i64>,
  pub name: String,
  pub short_name: String,
}

impl ModeInfo {
  fn new(name: String, short_name: String) -> Self {
    ModeInfo {
      name,
      short_name,
      blinkoff: None,
      blinkon: None,
      blinkwait: None,
      cell_percentage: None,
      cursor_shape: None,
      attr_id: None,
      attr_id_lm: None,
      hl_id: None,
      id_lm: None,
      mouse_shape: None,
    }
  }

  fn add(&mut self, prop: &str, value: &NvimValue) {
    match prop {
      "blinkoff" => self.blinkoff = value.as_i64(),
      "blinkon" => self.blinkon = value.as_i64(),
      "blinkwait" => self.blinkwait = value.as_i64(),
      "cell_percentage" => self.cell_percentage = value.as_i64(),
      "cursor_shape" => self.cursor_shape = value.as_str().map(|v| v.to_string()),
      "attr_id" => self.attr_id = value.as_i64(),
      "attr_id_lm" => self.attr_id_lm = value.as_i64(),
      "hl_id" => self.hl_id = value.as_i64(),
      "id_lm" => self.id_lm = value.as_i64(),
      "mouse_shape" => self.mouse_shape = value.as_i64(),
      "name" => self.name = value.as_str().unwrap().to_string(),
      "short_name" => self.short_name = value.as_str().unwrap().to_string(),
      _ => unreachable!(),
    }
  }
}

#[derive(Clone, serde::Serialize)]
pub struct NeovimState {
  pub mode: String,        // TODO(smolck): Make type for this probably?
  pub buffer_type: String, // TODO(smolck): Same as above ^^^
  pub current_file: String,
  pub filetype: String,
  pub dir: String,
  pub cwd: String,
  pub colorscheme: String,
  pub revision: i64,
  pub line: i64,
  pub column: i64,
  pub editor_top_line: i64,
  pub editor_bottom_line: i64,
  pub absolute_filepath: String,
  pub mode_infos: HashMap<String, ModeInfo>,
}

#[derive(Clone)]
pub struct NeovimHandler {
  window: Arc<Mutex<Option<tauri::Window>>>,
  state: Arc<Mutex<NeovimState>>,
}

impl NeovimHandler {
  pub async fn start_new() -> (Arc<Mutex<Option<tauri::Window>>>, Nvim) {
    let window = Arc::new(Mutex::new(None));
    let arc = window.clone();
    let handler = NeovimHandler {
      window,
      state: Arc::new(Mutex::new(NeovimState {
        mode: "".to_string(),
        buffer_type: "".to_string(),
        current_file: "".to_string(),
        filetype: "".to_string(),
        dir: "".to_string(),
        cwd: "".to_string(),
        colorscheme: "".to_string(),
        revision: -1,
        line: 0,
        column: 0,
        editor_top_line: 0,
        editor_bottom_line: 0,
        absolute_filepath: "".to_string(),
        mode_infos: HashMap::new(),
      })),
    };

    let (nvim, io_handler, _child) = new_nvim_child_cmd(handler).await;
    spawn(async move {
      match io_handler.await {
        Err(joinerr) => eprintln!("Error joining IO loop: '{}'", joinerr),
        Ok(Err(err)) => {
          if !err.is_reader_error() {
            // One last try, since there wasn't an error with writing to the
            // stream
            /*nvim.err_writeln(&format!("Error: '{}'", err))
            .await
            .unwrap_or_else(|e| {
                // We could inspect this error to see what was happening, and
                // maybe retry, but at this point it's probably best
                // to assume the worst and print a friendly and
                // supportive message to our users
                eprintln!("Well, hmm... '{}'", e);
            });*/
          }

          if !err.is_channel_closed() {
            // Closed channel usually means neovim quit itself, or this plugin was
            // told to quit by closing the channel, so it's not always an error
            // condition.
            eprintln!("Error: '{}'", err);

            /*let mut source = err.source();
            while let Some(e) = source {
              eprintln!("Caused by: '{}'", e);
              source = e.source();
            }*/
          }
        }
        Ok(Ok(())) => {}
      }
    });

    (arc, nvim)
  }
}

macro_rules! handle_all {
  ($events:ident, $func:ident) => {
    JsonValue::Array(
      $events[1..]
        .iter()
        .map(|evt| $func(evt.as_array().unwrap()))
        .collect(),
    )
  };
}

#[async_trait]
impl Handler for NeovimHandler {
  type Writer = Compat<ChildStdin>;

  async fn handle_notify(
    &self,
    name: String,
    mut args: Vec<NvimValue>,
    _nvim: Neovim<Compat<ChildStdin>>,
  ) {
    let mut state = self.state.lock().await;
    let win = self.window.lock().await;
    let win = win.as_ref().expect("why haven't you set the window bro");

    match name.as_str() {
      "redraw" => {
        for events in args.iter() {
          let events = events.as_array().unwrap();
          let event_name = events[0].as_str().unwrap();

          let mut handled = false;

          // let event = event.as_array().unwrap();
          let maybe_payload = match event_name {
            "grid_line" => Some(handle_all!(events, parse_grid_line)),
            "grid_resize" => Some(handle_all!(events, parse_grid_resize)),
            "grid_cursor_goto" => Some(handle_all!(events, parse_grid_cursor_goto)),
            "grid_scroll" => Some(handle_all!(events, parse_grid_scroll)),
            "grid_clear" => Some(handle_all!(events, parse_grid_clear)),
            "grid_destroy" => Some(handle_all!(events, parse_grid_destroy)),
            "cmdline_show" => Some(handle_all!(events, parse_cmdline_show)),
            "cmdline_hide" => Some(JsonValue::Null),
            "cmdline_pos" => {
              let event = events[1].as_array().unwrap();
              Some(json!([
                event[0].as_i64().unwrap(),
                event[1].as_i64().unwrap(),
              ]))
            }
            "win_close" => Some(handle_all!(events, parse_win_close)),
            "win_pos" => Some(handle_all!(events, parse_win_pos)),
            "popupmenu_show" => {
              events[1..]
                .iter()
                .map(|evt| parse_popupmenu_show(evt.as_array().unwrap()))
                .for_each(|pmenu_show| {
                  let (evt_name, payload) = if pmenu_show.is_wildmenu {
                    (
                      "wildmenu_show",
                      serde_json::to_value(pmenu_show.items).unwrap(),
                    )
                  } else {
                    ("popupmenu_show", serde_json::to_value(pmenu_show).unwrap())
                  };

                  win
                    .emit(evt_name, payload)
                    .expect(&format!("couldn't send {}", evt_name));
                });

              handled = true;
              None
            }
            "popupmenu_hide" => Some(JsonValue::Null),
            "popupmenu_select" => Some(JsonValue::from(
              events[1].as_array().unwrap()[0].as_i64().unwrap(),
            )),
            "default_colors_set" => Some(handle_all!(events, parse_default_colors_set)),
            "hl_attr_define" => Some(handle_all!(events, parse_hl_attr_define)),
            "option_set" => Some(handle_all!(events, parse_option_set)),
            "msg_show" => {
              for event in events[1..].iter() {
                let info = parse_msg_show(event.as_array().unwrap());
                if let MessageKind::Unknown = info.kind {
                  // TODO(smolck): I was getting this weird `<` message on `:w<cr>` and this
                  // makes it go into the status message part of the statusline . . . ??
                  win
                    .emit("messages.status", info.message)
                    .expect("failed to emit messages.control event");
                } else {
                  win
                    .emit(
                      if info.replace_last {
                        "messages.show"
                      } else {
                        "messages.append"
                      },
                      info,
                    )
                    .expect("failed to emit messages.show or messages.append event");
                }
              }

              handled = true;

              None
            }
            "msg_clear" => Some(JsonValue::Null),
            "msg_showcmd" | "msg_showmode" => {
              let messages = events[1].as_array().unwrap();
              if messages.is_empty() {
                // TODO(smolck): Is this ever even run/possible?
                win
                  .emit("messages.control", "")
                  .expect("failed to emit messages.control event");
              } else {
                for message in messages {
                  let message = message.as_array().unwrap();
                  if message.is_empty() {
                    win
                      .emit("messages.control", "")
                      .expect("failed to emit messages.control event");
                  } else {
                    // TODO(smolck): What . . . why . . . ?
                    let message = message[0].as_array().unwrap();

                    // let hl_id = message[0].as_str().unwrap();
                    let text = message[1].as_str().unwrap();

                    win
                      .emit("messages.control", text)
                      .expect("failed to emit messages.control event");
                  }
                }
              }

              handled = true;
              None
            }
            "msg_history_show" => {
              let messages = events[1].as_array().unwrap()[0].as_array().unwrap();

              win
                .emit(
                  "msg_history_show",
                  messages
                    .iter()
                    .map(|msg| {
                      let msg = msg.as_array().unwrap();
                      let kind = MessageKind::from_kind_str(msg[0].as_str().unwrap());
                      let message = msg[1]
                        .as_array()
                        .unwrap()
                        .iter()
                        .fold(String::new(), |acc, x| {
                          acc + x.as_array().unwrap()[1].as_str().unwrap()
                        });

                      serde_json::to_value(MessageInfo {
                        message,
                        kind,
                        replace_last: false,
                      })
                      .unwrap()
                    })
                    .collect::<Vec<JsonValue>>(),
                )
                .expect("failed to emit msg_history_show event");

              handled = true;
              None
            }
            "msg_ruler" => {
              // we display our own ruler based on cursor position. why use this?  i think
              // maybe we could use 'set noruler' or 'set ruler' to determine if we show the
              // ruler block in the statusline (with these msg_ruler events)
              handled = true;
              None
            }

            /*"win_hide" => {
              println!("win_hide stuff: {:?}", evt[1]);
            }*/
            "set_title" => {
              // TODO(smolck)
              println!("set title: {:?}", events);
              None
            }
            "win_viewport" => {
              for event in events[1..].iter() {
                let event = event.as_array().unwrap();
                state.line = event[4].as_i64().unwrap();
                state.column = event[5].as_i64().unwrap();
                state.editor_top_line = event[2].as_i64().unwrap();
                state.editor_bottom_line = event[3].as_i64().unwrap();
              }

              handled = true;
              None
            }
            "flush" => {
              // No need to worry about this (afaik), since we do the win layout thing
              // below regardless. Although . . .
              // TODO(smolck): maybe we shouldn't do that?
              handled = true;
              None
            }
            "mode_change" => {
              // TODO(smolck): This assumes only one mode_change event will be sent at a
              // time (?) . . . is that safe?
              Some(
                serde_json::to_value(
                  state.mode_infos.get(
                    &events[1].as_array().unwrap()[0]
                      .as_str()
                      .unwrap()
                      .to_string(),
                  ),
                )
                .unwrap(),
              )
            }
            "mode_info_set" => {
              for event in events[1..].iter() {
                let event = event.as_array().unwrap();
                let infos = event[1].as_array().unwrap();
                for info in infos {
                  let mut mode_info = ModeInfo::new("".to_string(), "".to_string());
                  for (k, v) in info.as_map().unwrap().iter() {
                    mode_info.add(k.as_str().unwrap(), v);
                  }
                  state.mode_infos.insert(mode_info.name.clone(), mode_info);
                }
              }
              handled = true;
              None
            }
            _ => None,
          };

          if let Some(payload) = maybe_payload {
            win
              .emit(event_name, payload)
              .expect(&format!("failed to emit {} event", event_name));
          } else {
            if !handled {
              println!("not handling event '{}'", event_name);
            }
          }
        }

        win
          .emit("dispose_invalid_wins_then_layout", JsonValue::Null)
          .expect("couldn't send event");
      }
      "uivonim-state" => {
        for (k, v) in args[0].as_map().unwrap() {
          let k = k.as_str().unwrap();
          match k {
            "mode" => state.mode = v.as_str().unwrap().to_string(),
            "bufferType" => state.buffer_type = v.as_str().unwrap().to_string(),
            "file" => state.current_file = v.as_str().unwrap().to_string(),
            "filetype" => state.filetype = v.as_str().unwrap().to_string(),
            "cwd" => state.cwd = v.as_str().unwrap().to_string(),
            "dir" => state.dir = v.as_str().unwrap().to_string(),
            "colorscheme" => state.colorscheme = v.as_str().unwrap().to_string(),
            "absoluteFilepath" => state.absolute_filepath = v.as_str().unwrap().to_string(),

            "line" => state.line = v.as_i64().unwrap(),
            "column" => state.column = v.as_i64().unwrap(),
            "revision" => state.revision = v.as_i64().unwrap(),
            "editorTopLine" => state.editor_top_line = v.as_i64().unwrap(),
            "editorBottomLine" => state.editor_bottom_line = v.as_i64().unwrap(),
            _ => {
              eprintln!(
                "we should never get here: uivonim-state with key {:#?} and val {:#?}",
                k, v
              );
            }
          }

          // TODO(smolck): This is if we need to handle any state changes on the frontend . . . do
          // we?
          //
          // NOTE(smolck): If `NeovimState` above ever gains a field that isn't
          // i64 or String, this will break
          /*let v_as_str = v.as_str();
          let payload = if let Some(string) = v_as_str {
              json!({
                "thing_changed": k,
                "new_value": string,
              })
          } else {
              json!({
                "thing_changed": k,
                "new_value": v.as_i64().unwrap(),
              })
          };
          win
            .emit("uivonim_state_change", payload)
            .expect("couldn't emit uivonim_state_change event");*/
        }

        // TODO(smolck): Too slow? Don't need to serialize mode_infos maybe, idk
        win
          .emit("nvim_state", serde_json::to_value(state.clone()).unwrap())
          .unwrap();
      }
      "uivonim" => match args[0].as_str().unwrap() {
        "nc" => win.emit("show_nyancat", JsonValue::Null).expect("meow"),
        "buffers" => win.emit("show_buffers", JsonValue::Null).unwrap(),
        "pick-color" => win.emit("show_pick_color", JsonValue::Null).unwrap(),
        "explorer" => win.emit("show_explorer", JsonValue::Null).unwrap(),
        "code-action" => win
          .emit(
            "code_action",
            crate::helpers::nvim_val_to_json_val(args.remove(1)),
          )
          .unwrap(),
        "diagnostics" => win
          .emit(
            "lsp_diagnostics",
            crate::helpers::nvim_val_to_json_val(args.remove(1)),
          )
          .unwrap(),

        x => println!("this isn't a valid action: '{}'", x),
      },
      /*"uivonim-autocmd" => {
          let autocmd = args[0].as_str().unwrap();
          match autocmd {

          }
      }*/
      _ => println!("don't handle this notification yet: {:?}, {:?}", name, args),
    }
  }

  // TODO(smolck): Just leaving this here as a reminder to probably implement this.
  /*async fn handle_request(
    &self,
    _name: String,
    _args: Vec<Value>,
    _neovim: Neovim<Self::Writer>,
  ) -> Result<Value, Value> {
    Err(Value::from("Not implemented"))
  }*/
}

/// Here `ev` is of the form: [grid, row, col_start, cells]
///
/// See `:help ui-event-grid_line` in nvim for more info.
fn parse_grid_line(ev: &[NvimValue]) -> JsonValue {
  json!({
      "grid": ev[0].as_i64().unwrap(),
      "row": ev[1].as_i64().unwrap(),
      "col_start": ev[2].as_i64().unwrap(),
      "cells": json!(ev[3].as_array().unwrap().iter().map(|c| {
          json!([
              c[0].as_str().unwrap(),
              c[1].as_i64(),
              c[2].as_i64(),
          ])
      }).collect::<JsonValue>())
  })
}

/// `ev` of the form: [grid, win, start_row, start_col, width, height]
fn parse_win_pos(ev: &[NvimValue]) -> JsonValue {
  let win_id = rmpv::decode::read_value(&mut ev[1].as_ext().unwrap().1.as_slice()).unwrap();
  println!("grid id: {}", ev[0].as_i64().unwrap());
  json!([
    ev[0].as_i64().unwrap(),
    win_id.as_i64().unwrap(),
    ev[2].as_i64().unwrap(),
    ev[3].as_i64().unwrap(),
    ev[4].as_i64().unwrap(),
    ev[5].as_i64().unwrap(),
  ])
}

/// `ev` of the form [grid, width, height]
fn parse_grid_resize(ev: &[NvimValue]) -> JsonValue {
  json!([
    ev[0].as_i64().unwrap(),
    ev[1].as_i64().unwrap(),
    ev[2].as_i64().unwrap(),
  ])
}

/// `ev` of the form [grid, row, column]
fn parse_grid_cursor_goto(ev: &[NvimValue]) -> JsonValue {
  json!([
    ev[0].as_i64().unwrap(),
    ev[1].as_i64().unwrap(),
    ev[2].as_i64().unwrap(),
  ])
}

/// `ev` of the form [rgb_fg, rgb_bg, rgb_sp, cterm_fg, cterm_bg]
fn parse_default_colors_set(ev: &[NvimValue]) -> JsonValue {
  json!([
    ev[0].as_i64().unwrap(),
    ev[1].as_i64().unwrap(),
    ev[2].as_i64().unwrap(),
    ev[3].as_i64().unwrap(),
    ev[4].as_i64().unwrap(),
  ])
}

/// `ev` of the form [name, value]
fn parse_option_set(ev: &[NvimValue]) -> JsonValue {
  let option_name = ev[0].as_str().unwrap();

  // TODO(smolck): Covers all types the option value can be
  // in an option_set event? Or are there more than these three?
  match &ev[1] {
    NvimValue::Boolean(b) => json!([option_name, b,]),
    NvimValue::Integer(i) => json!([option_name, i.as_i64().unwrap(),]),
    NvimValue::String(str) => json!([option_name, str.as_str().unwrap()]),
    _ => unreachable!(),
  }
}

/// `ev` of the form [grid, top, bot, left, right, rows, cols]
fn parse_grid_scroll(ev: &[NvimValue]) -> JsonValue {
  json!([
    ev[0].as_i64().unwrap(),
    ev[1].as_i64().unwrap(),
    ev[2].as_i64().unwrap(),
    ev[3].as_i64().unwrap(),
    ev[4].as_i64().unwrap(),
    ev[5].as_i64().unwrap(),
    ev[6].as_i64().unwrap(),
  ])
}

fn parse_grid_clear(ev: &[NvimValue]) -> JsonValue {
  json!([ev[0].as_i64().unwrap()])
}

/// `ev` of the form [content, pos, firstc, prompt, indent, level]
fn parse_cmdline_show(ev: &[NvimValue]) -> JsonValue {
  let content = ev[0].as_array().unwrap();
  let position = ev[1].as_i64().unwrap();
  let firstc = ev[2].as_str().unwrap();
  let prompt = ev[3].as_str().unwrap();
  // TODO(smolck)
  // let indent = ev[4].as_i64().unwrap();
  // let level = ev[5].as_i64().unwrap();

  // TODO: process attributes
  let cmd = content
    .iter()
    .fold(String::from(""), |acc, v| acc + v[1].as_str().unwrap());

  json!({
    "cmd": cmd,
    "firstc": firstc,
    "prompt": prompt,
    "kind": if prompt.is_empty() { ":" } else { firstc },
    "position": position,
  })
}

/*interface HighlightInfoEvent {
  kind: 'ui' | 'syntax' | 'terminal'
  ui_name: string
  hi_name: string
  id: number
}*/

/// `ev` of the form [id, rgb_attr, cterm_attr, info]
fn parse_hl_attr_define(ev: &[NvimValue]) -> JsonValue {
  let id = ev[0].as_i64().unwrap();
  let mut attr = serde_json::Map::new();

  for (k, v) in ev[1].as_map().unwrap() {
    attr.insert(
      k.as_str().unwrap().to_string(),
      match v {
        // See docs for `hl_attr_define` in `:help ui-events` in nvim.
        // foreground, background, special, cterm_fg, cterm_bg keys
        NvimValue::Integer(i) => JsonValue::from(i.as_i64().unwrap()),
        // reverse, italic, bold keys
        NvimValue::String(s) => JsonValue::from(s.to_string()),
        // underline, undercurl keys
        NvimValue::Boolean(b) => JsonValue::from(*b),
        _ => {
          eprintln!("umm . . .");
          JsonValue::Null
          // unreachable!()
        }
      },
    );
  }

  let info = ev[3]
    .as_array()
    .unwrap()
    .iter()
    .map(|m| {
      let mut map = serde_json::Map::new();
      for (k, v) in m.as_map().unwrap() {
        map.insert(
          k.as_str().unwrap().to_string(),
          match v {
            // See `:help ui-hlstate` in nvim.
            // kind, ui_name, and hi_name keys
            NvimValue::String(s) => JsonValue::from(s.to_string()),
            // id key
            NvimValue::Integer(i) => JsonValue::from(i.as_i64().unwrap()),
            x => {
              eprintln!("umm . . . {:?}", x);
              unreachable!()
            }
          },
        );
      }
      JsonValue::Object(map)
    })
    .collect::<Vec<JsonValue>>();

  json!({
    "id": id,
    "attr": attr,
    "info": info,
  })
}

#[derive(serde::Serialize, Debug)]
struct PmenuShowItem {
  word: String,
  kind: String,
  menu: String,
  info: String,
}

#[derive(serde::Serialize, Debug)]
struct PmenuShow {
  is_wildmenu: bool,
  row: i64,
  col: i64,
  /// Only exists if !is_wildmenu
  grid: Option<i64>,
  index: i64,
  items: Vec<PmenuShowItem>,
}

fn parse_popupmenu_show(ev: &[NvimValue]) -> PmenuShow {
  let items = ev[0].as_array().unwrap();
  let selected_idx = ev[1].as_i64().unwrap();
  let row = ev[2].as_i64().unwrap();
  let col = ev[3].as_i64().unwrap();
  let grid = ev[4].as_i64().unwrap();

  let items = items
    .iter()
    .map(|v| {
      let arr = v.as_array().unwrap();

      PmenuShowItem {
        word: arr[0].as_str().unwrap().to_string(),
        kind: arr[1].as_str().unwrap().to_string(),
        menu: arr[2].as_str().unwrap().to_string(),
        info: arr[3].as_str().unwrap().to_string(),
      }
    })
    .collect::<Vec<PmenuShowItem>>();

  let is_wildmenu = if grid == -1 { true } else { false };
  PmenuShow {
    is_wildmenu,
    row,
    col,
    index: selected_idx,
    items,
    grid: if is_wildmenu { None } else { Some(grid) },
  }
}

fn parse_win_close(ev: &[NvimValue]) -> JsonValue {
  json!(ev[0].as_i64().unwrap())
}

fn parse_grid_destroy(ev: &[NvimValue]) -> JsonValue {
  json!(ev[0].as_i64().unwrap())
}

#[derive(serde::Serialize, Debug)]
enum MessageKind {
  #[serde(rename(serialize = "info"))]
  Info,
  #[serde(rename(serialize = "error"))]
  Error,
  #[serde(rename(serialize = "system"))]
  System,
  #[serde(rename(serialize = "unknown"))]
  Unknown,
}

#[derive(serde::Serialize, Debug)]
struct MessageInfo {
  message: String,
  kind: MessageKind,
  replace_last: bool,
}

impl MessageKind {
  fn from_kind_str(kind: &str) -> MessageKind {
    match kind {
      "echo" | "echomsg" => MessageKind::Info,
      "echoerr" | "emsg" => MessageKind::Error,
      "quickfix" | "return_prompt" => MessageKind::System,
      _ => MessageKind::Unknown,
    }
  }
}

/// `ev` of the form [kind, content, replace_last]
fn parse_msg_show(ev: &[NvimValue]) -> MessageInfo {
  // ['echo', MessageKind.Info],
  // ['emsg', MessageKind.Error],
  // ['echoerr', MessageKind.Error],
  // ['echomsg', MessageKind.Info],
  // ['quickfix', MessageKind.System],
  // // TODO: handle prompts
  // ['return_prompt', MessageKind.System],
  let kind = MessageKind::from_kind_str(ev[0].as_str().unwrap());
  let message = ev[1].as_array().unwrap().iter().fold(
    String::new(),
    // `msg` here is [hlid, text] (I think; TODO(smolck): verify)
    |acc, msg| acc + msg.as_array().unwrap()[1].as_str().unwrap(),
  );
  let replace_last = ev[2].as_bool().unwrap();

  MessageInfo {
    kind,
    message,
    replace_last,
  }
}
