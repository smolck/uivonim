local uivonim = {}
local util = vim.lsp.util

local function get_cursor_pos()
  local pos = vim.api.nvim_win_get_cursor(0)
  local win_id = vim.fn.win_getid()
  return pos[1] - vim.fn.getwininfo(win_id)[1].topline, pos[2]
end

function uivonim.signature_help_close()
  vim.fn.Uivonim('signature-help-close')
end

function uivonim.signature_help(_, method, result)
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
  vim.fn.Uivonim('signature-help', method, result, row, col)

  -- Close autocmd
  vim.api.nvim_command("autocmd CursorMoved <buffer> ++once lua pcall(require'uivonim'.signature_help_close, true)")
end

uivonim.lsp_callbacks = {
  ['textDocument/signatureHelp'] = uivonim.signature_help;
}

return uivonim
