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

#[async_trait]
impl Handler for NeovimHandler {
  type Writer = Compat<ChildStdin>;

  async fn handle_notify(
    &self,
    name: String,
    args: Vec<NvimValue>,
    _nvim: Neovim<Compat<ChildStdin>>,
  ) {
    match name.as_str() {
      "redraw" => {
        let state = &mut self.state.lock().await;
        let win = self.window.lock().await;
        let win = win.as_ref().expect("why haven't you set the window bro");

        for evt in args.iter() {
          let event_name = evt[0].as_str().unwrap();
          let evt = evt.as_array().unwrap();
          let payload = evt[1..]
            .iter()
            .map(|v| v.as_array().unwrap().as_slice())
            .map(match event_name {
              "grid_line" => parse_grid_line,
              "grid_resize" => parse_grid_resize,
              "grid_cursor_goto" => parse_grid_cursor_goto,
              "grid_scroll" => parse_grid_scroll,
              "grid_clear" => |ev: &[NvimValue]| json!([ev[0].as_i64().unwrap()]),
              "cmdline_show" => parse_cmdline_show,
              "cmdline_hide" => |_ev: &[NvimValue]| JsonValue::Null,
              "cmdline_pos" => |ev: &[NvimValue]|
                json!([
                  ev[0].as_i64().unwrap(),
                  ev[1].as_i64().unwrap(),
                ]),
              "win_pos" => parse_win_pos,
              "popupmenu_show" => parse_popupmenu_show,
              "popupmenu_hide" => |_ev: &[NvimValue]| JsonValue::Null,
              "popupmenu_select" => |ev: &[NvimValue]| JsonValue::from(ev[0].as_i64().unwrap()),
              "default_colors_set" => parse_default_colors_set,
              "hl_attr_define" => parse_hl_attr_define,
              "option_set" => parse_option_set,
              _ => |_: &[NvimValue]|
                  // TODO(smolck): I mean it's kinda hacky, sure, but . . . not thinking of a
                  // better/another way to do this rn
                  JsonValue::from("[uivonim]: bruh not handled so stop it"),
            })
            .collect::<Vec<JsonValue>>();

          if !payload.contains(&JsonValue::from("[uivonim]: bruh not handled so stop it")) {
            win
              .emit(event_name, payload)
              .expect(&format!("failed to emit {} event", event_name));
          } else {
            // Events I can't handle above because Rust-y reasons (more specifically,
            // capturing closure -> fn coercion isn't a thing apparently)
            match event_name {
              "set_title" => { // TODO(smolck): Does this work?
                win.set_title(evt[1].as_array().unwrap()[0].as_str().unwrap())
                .expect("okay why can't I set the title?");
              }
              "win_viewport" => {
                let evt = evt[1].as_array().unwrap();
                state.line = evt[4].as_i64().unwrap();
                state.column = evt[5].as_i64().unwrap();
                state.editor_top_line = evt[2].as_i64().unwrap();
                state.editor_bottom_line = evt[3].as_i64().unwrap();
              }
              "flush" => {
                // No need to worry about this (afaik), since we do the win layout thing
                // below regardless. Although . . .
                // TODO(smolck): maybe we shouldn't do that?
              }
              "mode_change" => {
                // TODO(smolck): This assumes only one mode_change event will be sent at a
                // time (?) . . . is that safe?
                let evt = evt[1].as_array().unwrap();

                win
                  .emit(
                    event_name,
                    state.mode_infos.get(&evt[0].as_str().unwrap().to_string()),
                  )
                  .expect(&format!("failed to emit {} event", event_name));
              }
              "mode_info_set" => {
                let evt = evt[1].as_array().unwrap();
                let infos = evt[1].as_array().unwrap();
                for info in infos {
                  let mut mode_info = ModeInfo::new("".to_string(), "".to_string());
                  for (k, v) in info.as_map().unwrap().iter() {
                    mode_info.add(k.as_str().unwrap(), v);
                  }
                  state.mode_infos.insert(mode_info.name.clone(), mode_info);
                }
              }
              _ => println!("not handling UI event: '{}'", event_name),
            }
          }
        }

        win
          .emit("dispose_invalid_wins_then_layout", JsonValue::Null)
          .expect("couldn't send event");
      }
      /*"uivonim-state" => {
        println!("new state! {:?}", args);
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

fn parse_popupmenu_show(ev: &[NvimValue]) -> JsonValue {
  let items = ev[0].as_array().unwrap();
  let selected_idx = ev[1].as_i64().unwrap();
  let row = ev[2].as_i64().unwrap();
  let col = ev[3].as_i64().unwrap();
  let grid = ev[4].as_i64().unwrap();

  let items = items
    .iter()
    .map(|v| {
      let arr = v.as_array().unwrap();

      json!({
        "word": arr[0].as_str().unwrap(),
        "kind": arr[1].as_str().unwrap(),
        "menu": arr[2].as_str().unwrap(),
        "info": arr[3].as_str().unwrap(),
      })
    })
    .collect::<Vec<JsonValue>>();

  json!({
    "row": row,
    "col": col,
    "grid": grid,
    "index": selected_idx,
    "items": items,
  })
}