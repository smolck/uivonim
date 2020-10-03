local M = {}
local util = vim.lsp.util
local notify_uivonim = require'uivonim'.notify_uivonim

local function get_cursor_pos()
  local pos = vim.api.nvim_win_get_cursor(0)
  local win_id = vim.fn.win_getid()
  return pos[1] - vim.fn.getwininfo(win_id)[1].topline, pos[2]
end

function M.signature_help_close()
  notify_uivonim('signature-help-close')
end

function M.signature_help(_, method, result)
  if not (result and result.signatures and result.signatures[1]) then
    print('No signature help available')
    return
  end

  local lines = util.convert_signature_help_to_markdown_lines(result)
  lines = util.trim_empty_lines(lines)

  if vim.tbl_isempty(lines) then
    print('No signature help available')
    return
  end

  local row, col = get_cursor_pos()
  notify_uivonim('signature-help', method, result, row, col)

  -- Close autocmd
  vim.api.nvim_command("autocmd CursorMoved <buffer> ++once lua pcall(require'uivonim/lsp'.signature_help_close, true)")
end

function M.hover_close()
  notify_uivonim('hover-close')
end

function M.hover(_, method, result)
  if not (result and result.contents) then
    -- TODO(smolck): Maybe let the user know somehow by telling Uivonim about it?
    return
  end

  dump(result.contents)

  -- TODO(smolck): Remove this and just handle on the Uivonim side (probably)
  local markdown_lines = util.convert_input_to_markdown_lines(result.contents)
  markdown_lines = util.trim_empty_lines(markdown_lines)
  if vim.tbl_isempty(markdown_lines) then
    return
  end

  notify_uivonim('hover', method, markdown_lines)

  -- Close autocmd
  vim.api.nvim_command(
    "autocmd CursorMoved,BufHidden,InsertCharPre <buffer> ++once lua pcall(require'uivonim/lsp'.hover_close, true)"
  )
end

function M.references(_, method, result)
  if not result then return end

  local list = util.locations_to_items(result)
  notify_uivonim('references', method, list)
end

M.callbacks = {
  ['textDocument/signatureHelp'] = M.signature_help;
  ['textDocument/hover'] = M.hover;
  ['textDocument/references'] = M.references;
}

return M
