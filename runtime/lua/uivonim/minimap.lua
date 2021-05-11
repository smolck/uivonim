local M = {}
local notify_uivonim = require'uivonim'.notify_uivonim

-- Derived from
-- https://github.com/nvim-telescope/telescope.nvim/blob/c061c216bfe082384d542a487ce02e9aed6177df/lua/telescope/builtin/files.lua#L378-L422
local function get_lines_and_highlights(bufnr)
  local filetype = vim.api.nvim_buf_get_option(bufnr, 'filetype')
  filetype = require'nvim-treesitter.parsers'.ft_to_lang(filetype)

  local parser_ok, parser = pcall(vim.treesitter.get_parser, bufnr, filetype)
  local query_ok, query = pcall(vim.treesitter.get_query, filetype, 'highlights')
  if (not parser_ok) or (not query_ok) then return end

  local line_highlights = setmetatable({}, {
    __index = function(t, k)
      local obj = {}
      rawset(t, k, obj)
      return obj
    end,
  })

  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local root = parser:parse()[1]:root()

  local highlighter = vim.treesitter.highlighter.new(parser)
  local highlighter_query = highlighter:get_query(filetype)

  for id, node in query:iter_captures(root, bufnr, 0, -1) do
    local hl = highlighter_query.hl_cache[id]
    if hl then
      local row1, col1, row2, col2 = node:range()

      if row1 == row2 then
        local row = row1 + 1

        for index = col1, col2 do
          line_highlights[row][index] = hl
        end
      else
        local row = row1 + 1
        for index = col1, #lines[row] do
            line_highlights[row][index] = hl
        end

        while row < row2 + 1 do
          row = row + 1

          for index = 0, #lines[row] do
            line_highlights[row][index] = hl
          end
        end
      end
    end
  end

  local new_lines = {}
  local api = vim.api

  local info = vim.fn.getwininfo(vim.fn.win_getid())[1]
  for i, line in ipairs(lines) do
    local row = i
    local n = 0

    local in_viewport = row >= info.topline and row <= info.botline
    new_lines[i] = { in_viewport }

    -- https://stackoverflow.com/a/832414
    for char in line:gmatch('.') do
      table.insert(new_lines[i],
        {
          char = char,
          hl = line_highlights[row][n] and api.nvim_get_hl_by_name(line_highlights[row][n], true) or nil,
        })
      n = n + 1
    end
  end

  return new_lines
end

local enabled = false

function M.disable()
  enabled = false
  vim.cmd [[ autocmd! UivonimMinimap ]]
end

function M.enable()
  enabled = true
  vim.cmd [[
    augroup UivonimMinimap
      autocmd WinScrolled * silent lua require'uivonim/minimap'.show()
    augroup end
  ]]
end

function M.show()
  if enabled then
    local lines_and_hls = get_lines_and_highlights(0)
    if lines_and_hls then
      notify_uivonim('minimap', lines_and_hls)
    end
  end
end

function M.hide()
  if enabled then
    notify_uivonim('minimap-hide')
  end
end

return M
