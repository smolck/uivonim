local M = {}

function M.notify_uivonim(message, ...)
  vim.rpcnotify(0, 'uivonim', message, {...})
end

function M.disable_default_shortcuts()
  M.notify_uivonim('unregister-default-shortcuts')
end

function M.enable_default_shortcuts()
  M.notify_uivonim('register-default-shortcuts')
end

function M.unregister_shortcuts(shortcuts)
  M.notify_uivonim('unregister-shortcuts', shortcuts)
end

function M.register_shortcuts(shortcuts)
  M.notify_uivonim('register-shortcuts', shortcuts)
end

return M
