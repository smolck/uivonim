local M = {}

function M.notify_uivonim(message, ...)
  vim.rpcnotify(0, 'uivonim', message, {...})
end

return M
