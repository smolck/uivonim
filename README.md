<p align="center">
	<img src="./art/header.png" alt="Uivonim header"></img>
</p>

![Typecheck](https://github.com/smolck/uivonim/workflows/Typecheck/badge.svg) ![Test](https://github.com/smolck/uivonim/workflows/Test/badge.svg) [![Gitter](https://badges.gitter.im/uivonim/community.svg)](https://gitter.im/uivonim/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

> NOTE: Due to [neovim/neovim#13196](https://github.com/neovim/neovim/issues/13196), if you have `conceallevel` set to a value higher than 0 CPU usage may be abnormally high. See [#39 (comment)](https://github.com/smolck/uivonim/issues/39#issuecomment-719816263).

Uivonim is a fork of Veonim,
"a simple modal IDE built on Neovim and VSCode extensions" written in Electron with WebGL GPU
rendering and multithreading. The goal of
Uivonim is to use Veonim as a base for building a feature-rich cross-platform GUI
that leverages the latest Neovim features (floating windows, builtin LSP, Lua)
without reliance on VSCode extensions.

<img width="1552" alt="main" src="https://user-images.githubusercontent.com/46855713/132102617-8a85965c-8ad7-4cc6-bd34-c63db2197179.png">

## Goals

- 100% compatibility with Neovim (see [#9421](https://github.com/neovim/neovim/issues/9421))
- All configuration done via vimrc with vimscript/Lua/remote plugins
- GUI features and eyecandy
- Full support for international keyboard layouts and dead keys (tested on macOS and Linux)
- Fast, building upon the work done by @breja, with things like WebGL GPU
  rendering and multithreading
- Extensibility via a Lua API providing access to frontend GUI features such as
  [LSP hover/signature help/symbols](https://github.com/smolck/uivonim/wiki/Builtin-LSP) and a fuzzy finder UI

## Getting Started

Download the latest GitHub release, or build from source (see the "build" section at the bottom of this README). Alternatively,
if you use Arch Linux, there is an [AUR package](https://aur.archlinux.org/packages/uivonim-git/) for uivonim, kindly created
by [@SilverRainZ](https://github.com/SilverRainZ) (see [#55](https://github.com/smolck/uivonim/issues/55)).

## Build

Install the following things:

- node/npm
- latest Neovim (i.e., nightly or built from master)

Then run:

- `npm ci` - standard issue download 5 million node_modules
- `npm run prod` (optional) - run release build w/out packaging
- `npm run package` - use electron-builder to create a binary package

Binaries available in `dist`.

### Development

- `npm ci` - install deps as mentioned above
- `npm run dev` - run dev build

If you have any questions about Uivonim's code, making a change, etc., feel free to ping me (@smolck)
[on Gitter](https://gitter.im/uivonim/community).

## Feature Showcase

See [the wiki](https://github.com/smolck/uivonim/wiki/Builtin-LSP) for setup for
the signature help, float, etc. features.

### Signature Help

![signature_help](https://user-images.githubusercontent.com/46855713/132102632-ac64491b-3710-4a8b-9e56-0944d7f293ff.png)

### Hover

![hover](https://user-images.githubusercontent.com/46855713/132102651-78b5b3b9-4253-4fb4-af85-887d131fe860.png)

### Code Actions

![code_action](https://user-images.githubusercontent.com/46855713/132102653-dec21adc-3b77-48a6-a0b4-aadfbde0f309.png)

### References

![references](https://user-images.githubusercontent.com/46855713/132102660-9a4a4287-31a9-444c-b5f4-b24f8e4cf9a4.png)

### Nyancat

`:Uivonim nc`

![nyancat](https://user-images.githubusercontent.com/46855713/132102661-82b88bdb-13e9-49fb-bce3-5ee22285092d.png)

## Other Cool Projects

- [Neovide](https://github.com/Kethku/neovide)
- [GoNeovim](https://github.com/akiyosi/goneovim)
- [GNvim](https://github.com/vhakulinen/gnvim)

## Special Thanks

An absolutely massive thank you to @breja for all
of the work you did on the original Veonim project; without your work
(including the amazing achievement of making Electron snappy!) and vision
for the original project, Uivonim would not exist. Thank you!
