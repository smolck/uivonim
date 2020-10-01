const { app, BrowserWindow } = require('electron')
let win

app.on('ready', () => {
  win = new BrowserWindow({ focus: true })
  win.loadURL(`file:///${__dirname}/sizer.html`)
  win.webContents.openDevTools()
})
