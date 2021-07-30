use async_trait::async_trait;
use nvim_rs::{compat::tokio::Compat, create::tokio as create, Handler, Neovim};
use rmpv::Value;

use tauri::async_runtime::spawn;

use futures::lock::Mutex;
use std::sync::Arc;

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
  let runtime_dir = canonicalize(PathBuf::from("../runtime"))
    .expect("this should work, getting the runtime dir");
  let runtime_dir = runtime_dir
    .to_str()
    .expect("runtime dir path is valid utf8");

  create::new_child_cmd(
    Command::new("nvim").args(&[
      "--cmd",
      &format!("let $PATH .= ':{runtime_dir}/{platform}' | let &runtimepath .= ',{runtime_dir}'",
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
    args: Vec<Value>,
    _neovim: Neovim<Compat<ChildStdin>>,
  ) {
    match name.as_str() {
      "redraw" => {
        let win = self.window.lock().await;
        let win = win.as_ref().expect("why haven't you set the window bro");

        for evt in args.iter() {
          // println!("{:?}", evt);
          match evt[0].as_str().unwrap() {
            "grid_line" => {
              for grid_line in evt.as_array().unwrap()[1..].iter() {
                println!("emittin the grid line bro");
                win
                  .emit("grid_line", parse_grid_line(&grid_line.as_array().unwrap()))
                  .expect("failed to emit grid_line event");
              }
            }
            _ => {}
          }
        }
      }
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
fn parse_grid_line(ev: &[Value]) -> serde_json::Value {
  use serde_json::json;

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
      }).collect::<serde_json::Value>())
  })
}
