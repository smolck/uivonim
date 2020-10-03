local M = {}

function M.notify_uivonim(message, ...)
  vim.fn.rpcnotify(0, 'uivonim', message, {...})
end

return M
