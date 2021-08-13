local M = {}
local Job = require('plenary.job')
local notify_uivonim = require('uivonim').notify_uivonim

local function shell(cwd, cb, ...)
  local args = { ... }
  local command = args[1]
  table.remove(args, 1)

  local stuff = {}
  local j = Job:new({
    command = command,
    args = args,
    cwd = cwd,
    enable_recording = true,
    on_stdout = function(_, data)
      table.insert(stuff, data)
    end,
    on_exit = vim.schedule_wrap(function()
      cb(stuff)
    end),
  })

  local ok = pcall(function()
    j:start()
  end)

  if not ok then
    cb()
  end

  -- TODO(smolck): args here should be . . . ?
  -- def at https://github.com/nvim-lua/plenary.nvim/blob/6a51028a103518826423b0c408077ea7e258f1ee/lua/plenary/job.lua#L445
  -- local _, res = pcall(function()
  --   return j:sync(2000, 5)
  -- end)
  -- return res
end

local function get_git_status(cwd, cb)
  shell(cwd, function(res)
    if not res then
      cb()
    else
      local sum = { additions = 0, deletions = 0 }
      local mapped = vim.tbl_map(function(s)
        -- TODO(smolck): Does this work on all OSes & circumstances etc.?
        local stuff = vim.fn.split(s, '\t')

        return {
          additions = tonumber(stuff[1]),
          deletions = tonumber(stuff[2]),
        }
      end, res)

      for _, tbl in ipairs(mapped) do
        sum.additions = sum.additions + tbl.additions
        sum.deletions = sum.deletions + tbl.deletions
      end

      cb(sum)
    end
  end, 'git', 'diff', '--numstat')
end

local function get_branch(cwd, cb)
  shell(cwd, cb, 'git', 'rev-parse', '--abbrev-ref', 'HEAD')
end

-- TODO(smolck): Make this smarter? i.e. only `notify_uivonim` if the
-- branch/status is different from last time.

-- TODO(smolck): Does this need to be async with getting the branch
-- and status? Don't want to slow things down . . .
function M.notify_branch()
  local cwd = vim.fn.getcwd()
  get_branch(cwd, function(maybe_branch)
    local branch = maybe_branch and maybe_branch[1] or ''
    notify_uivonim('git_branch', branch)
  end)
end

function M.notify_status()
  local cwd = vim.fn.getcwd()
  get_git_status(cwd, function(maybe_status)
    local status = maybe_status or { additions = 0, deletions = 0 }
    notify_uivonim('git_status', status)
  end)
end

return M
