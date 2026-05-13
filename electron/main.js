const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

const APP_TITLE = 'MotorAnalyzer - 3상 유도전동기 시뮬레이터'
const DEV_SERVER_URL = 'http://127.0.0.1:5173'
const isDev = process.argv.includes('--dev')
const shouldAutoExit = process.env.ELECTRON_AUTO_EXIT === '1'

let mainWindow

if (shouldAutoExit) {
  app.commandLine.appendSwitch('no-sandbox')
  app.setPath('userData', path.join(app.getPath('temp'), 'MotorAnalyzerElectronTest'))
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1200,
    minHeight: 760,
    title: APP_TITLE,
    backgroundColor: '#08121b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (!shouldAutoExit) {
      mainWindow.show()
    }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    if (shouldAutoExit) {
      app.quit()
    }
  })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(APP_TITLE)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL)
    return
  }

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
