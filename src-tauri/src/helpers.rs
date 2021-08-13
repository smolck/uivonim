use core::slice::SlicePattern;
use rmpv::Utf8String;
use serde_json::json;
use std::convert::TryFrom;

// TODO(smolck): Is this like *abismally* slow?
pub fn json_val_to_nvim_val(json_val: serde_json::Value) -> nvim_rs::Value {
  use nvim_rs::Value as N;
  use serde_json::Value as J;

  match json_val {
    J::Object(map) => N::Map(
      map
        .into_iter()
        .map(|(k, v)| {
          (
            N::String(Utf8String::try_from(k).unwrap()),
            json_val_to_nvim_val(v),
          )
        })
        .collect(),
    ),
    J::Array(arr) => N::Array(arr.into_iter().map(|x| json_val_to_nvim_val(x)).collect()),
    J::Bool(bool) => N::Boolean(bool),
    J::Number(num) => N::F64(num.as_f64().unwrap()),
    J::String(str) => N::String(Utf8String::try_from(str).unwrap()),
    J::Null => N::Nil,
  }
}

pub fn nvim_val_to_json_val(nvim_val: nvim_rs::Value) -> serde_json::Value {
  use nvim_rs::Value as N;
  use serde_json::Value as J;

  match nvim_val {
    N::Array(vec) => J::Array(vec.into_iter().map(|x| nvim_val_to_json_val(x)).collect()),
    N::Binary(vec) => J::Array(vec.into_iter().map(|x| J::Number(x.into())).collect()),
    N::Boolean(bool) => J::Bool(bool),

    // TODO(smolck): How to handle this? Need to handle this?
    N::Ext(_kind, _bytes) => unimplemented!(),

    N::String(str) => J::String(str.into_str().unwrap()),
    N::Nil => J::Null,
    N::F32(x) => json!(x),
    N::F64(x) => json!(x),
    N::Integer(x) => json!(x.as_f64()),
    N::Map(map) => J::Object(
      map
        .into_iter()
        .map(|(k, v)| (k.as_str().unwrap().into(), nvim_val_to_json_val(v)))
        .collect(),
    ),
  }
}

pub fn read_i64_from_ext(ext: &nvim_rs::Value) -> i64 {
  rmpv::decode::read_value(&mut ext.as_ext().unwrap().1.as_slice())
    .unwrap()
    .as_i64()
    .unwrap()
}
