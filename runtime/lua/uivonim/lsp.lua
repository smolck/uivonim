local M = {}
local util = vim.lsp.util
local notify_uivonim = require'uivonim'.notify_uivonim

local function get_cursor_pos()
  local pos = vim.api.nvim_win_get_cursor(0)
  local win_id = vim.fn.win_getid()
  return pos[1] - vim.fn.getwininfo(win_id)[1].topline, pos[2]
end

-- Most of this was taken from https://github.com/neovim/neovim/blob/569e75799d7015b15631c80cee1feec561f29df7/runtime/lua/vim/lsp/util.lua#L486
local function signature_help_to_show_params(signature_help)
  if not signature_help.signatures then
    return
  end

  --The active signature. If omitted or the value lies outside the range of
  --`signatures` the value defaults to zero or is ignored if `signatures.length
  --=== 0`. Whenever possible implementors should make an active decision about
  --the active signature and shouldn't rely on a default value.
  local show_params = {}
  local active_signature = signature_help.activeSignature or 0

  -- If the activeSignature is not inside the valid range, then clip it.
  if active_signature >= #signature_help.signatures then
    active_signature = 0
  end

  local signature = signature_help.signatures[active_signature + 1]
  if not signature then
    return
  end

  local row, col = get_cursor_pos()
  show_params.row = row
  show_params.col = col
  show_params.totalSignatures = #signature_help.signatures
  show_params.selectedSignature = active_signature
  show_params.label = signature.label
  show_params.documentation = signature.documentation.value or signature.documentation or ''

  if signature.parameters and #signature.parameters > 0 then
    local active_parameter = signature_help.activeParameter or 0

    -- If the activeParameter is not inside the valid range, then clip it.
    if active_parameter >= #signature.parameters then
      active_parameter = 0
    end

    local parameter = signature.parameters[active_parameter + 1]
    if parameter then
      --[=[
      --Represents a parameter of a callable-signature. A parameter can
      --have a label and a doc-comment.
      interface ParameterInformation {
        --The label of this parameter information.
        --
        --Either a string or an inclusive start and exclusive end offsets within its containing
        --signature label. (see SignatureInformation.label). The offsets are based on a UTF-16
        --string representation as `Position` and `Range` does.
        --
        --*Note*: a label of type string should be a substring of its containing signature label.
        --Its intended use case is to highlight the parameter label part in the `SignatureInformation.label`.
        label: string | [number, number];
        --The human-readable doc-comment of this parameter. Will be shown
        --in the UI but can be omitted.
        documentation?: string | MarkupContent;
      }
      --]=]
      show_params.activeParam = parameter.label

      if parameter.documentation and parameter.documentation ~= vim.NIL then
        show_params['paramDoc'] = parameter.documentation.value or parameter.documentation or ''
      end
    end
  end
  show_params.activeParam = show_params.activeParam or ''

  return show_params
end

function M.signature_help_close()
  notify_uivonim('signature-help-close')
end

function M.signature_help(_, method, result)
  if not (result and result.signatures and result.signatures[1]) then
    print('No signature help available')
    return
  end

  local show_params = signature_help_to_show_params(result)
  if not show_params then
    print('No signature help available')
    return
  end

  notify_uivonim('signature-help', method, show_params)

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

function M.symbols(_, method, result)
  if not result then return end

  -- TODO: use non-hierarchical UI element (i.e., strip filename) for documentSymbol
  notify_uivonim('references', method, util.symbols_to_items(result))
end

function M.code_action(_, _, actions)
  if actions == nil or vim.tbl_isempty(actions) then
    print("No code actions available")
    return
  end

  notify_uivonim('code-action', actions)
end

function M.handle_chosen_code_action(action_chosen)
  local buf = require'vim.lsp.buf'

  if action_chosen.edit or type(action_chosen.command) == "table" then
    if action_chosen.edit then
      util.apply_workspace_edit(action_chosen.edit)
    end
    if type(action_chosen.command) == "table" then
      buf.execute_command(action_chosen.command)
    end
  else
    buf.execute_command(action_chosen)
  end
end

M.callbacks = {
  ['textDocument/signatureHelp'] = M.signature_help;
  ['textDocument/hover'] = M.hover;
  ['textDocument/references'] = M.references;
  ['textDocument/codeAction'] = M.code_action;
  ['textDocument/documentSymbol'] = M.symbols;
  ['workspace/symbol'] = M.symbols;
}

return M
