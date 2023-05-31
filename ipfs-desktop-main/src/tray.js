const { Menu, Tray, shell, app, ipcMain, nativeTheme } = require('electron')
const i18n = require('i18next')
const path = require('path')
const addToIpfs = require('./add-to-ipfs')
const logger = require('./common/logger')
const store = require('./common/store')
const moveRepositoryLocation = require('./move-repository-location')
const runGarbageCollector = require('./run-gc')
const ipcMainEvents = require('./common/ipc-main-events')
const { setCustomBinary, clearCustomBinary, hasCustomBinary } = require('./custom-ipfs-binary')
const { STATUS } = require('./daemon')
const { IS_MAC, IS_WIN, VERSION, GO_IPFS_VERSION } = require('./common/consts')

const CONFIG_KEYS = require('./common/config-keys')

const { SHORTCUT: SCREENSHOT_SHORTCUT, takeScreenshot } = require('./take-screenshot')
const { isSupported: supportsLaunchAtLogin } = require('./auto-launch')
const createToggler = require('./utils/create-toggler')

function buildCheckbox (key, label) {
  return {
    id: key,
    label: i18n.t(label),
    click: () => { ipcMain.emit(ipcMainEvents.TOGGLE(key)) },
    type: 'checkbox',
    checked: false
  }
}

// Notes on this: we are only supporting accelerators on macOS for now because
// they natively work as soon as the menu opens. They don't work like that on Windows
// or other OSes and must be registered globally. They still collide with global
// accelerator. Please see ../utils/setup-global-shortcut.js for more info.
function buildMenu (ctx) {
  return Menu.buildFromTemplate([
    ...[
      ['ipfsIsStarting', 'yellow'],
      ['ipfsIsRunning', 'green'],
      ['ipfsIsStopping', 'yellow'],
      ['ipfsIsNotRunning', 'gray'],
      ['ipfsHasErrored', 'red'],
      ['runningWithGC', 'yellow'],
      ['runningWhileCheckingForUpdate', 'yellow']
    ].map(([status, color]) => ({
      id: status,
      label: i18n.t(status),
      visible: false,
      enabled: false,
      icon: path.resolve(path.join(__dirname, `../assets/icons/status/${color}.png`))
    })),
    {
      id: 'restartIpfs',
      label: i18n.t('restart'),
      click: () => { ctx.restartIpfs() },
      visible: false,
      accelerator: IS_MAC ? 'Command+R' : null
    },
    {
      id: 'startIpfs',
      label: i18n.t('start'),
      click: () => { ctx.startIpfs() },
      visible: false
    },
    {
      id: 'stopIpfs',
      label: i18n.t('stop'),
      click: () => { ctx.stopIpfs() },
      visible: false
    },
    { type: 'separator' },
    {
      id: 'webuiStatus',
      label: i18n.t('status'),
      click: () => { ctx.launchWebUI('/') }
    },
    {
      id: 'webuiFiles',
      label: i18n.t('files'),
      click: () => { ctx.launchWebUI('/files') }
    },
    {
      id: 'webuiPeers',
      label: i18n.t('peers'),
      click: () => { ctx.launchWebUI('/peers') }
    },
    { type: 'separator' },
    {
      id: 'takeScreenshot',
      label: i18n.t('takeScreenshot'),
      click: () => { takeScreenshot(ctx) },
      accelerator: IS_MAC ? SCREENSHOT_SHORTCUT : null,
      enabled: false
    },
    { type: 'separator' },
    {
      label: IS_MAC ? i18n.t('settings.preferences') : i18n.t('settings.settings'),
      submenu: [
        {
          id: 'webuiNodeSettings',
          label: i18n.t('settings.openNodeSettings'),
          click: () => { ctx.launchWebUI('/settings') }
        },
        { type: 'separator' },
        {
          label: i18n.t('settings.appPreferences'),
          enabled: false
        },
        buildCheckbox(CONFIG_KEYS.AUTO_LAUNCH, 'settings.launchOnStartup'),
        buildCheckbox(CONFIG_KEYS.OPEN_WEBUI_LAUNCH, 'settings.openWebUIAtLaunch'),
        buildCheckbox(CONFIG_KEYS.AUTO_GARBAGE_COLLECTOR, 'settings.automaticGC'),
        buildCheckbox(CONFIG_KEYS.SCREENSHOT_SHORTCUT, 'settings.takeScreenshotShortcut'),
        ...(IS_MAC ? [] : [buildCheckbox(CONFIG_KEYS.MONOCHROME_TRAY_ICON, 'settings.monochromeTrayIcon')]),
        { type: 'separator' },
        {
          label: i18n.t('settings.experiments'),
          enabled: false
        },
        buildCheckbox(CONFIG_KEYS.EXPERIMENT_PUBSUB, 'settings.pubsub'),
        buildCheckbox(CONFIG_KEYS.EXPERIMENT_PUBSUB_NAMESYS, 'settings.namesysPubsub')
      ]
    },
    {
      label: i18n.t('advanced'),
      submenu: [
        {
          label: i18n.t('openLogsDir'),
          click: () => { shell.openPath(app.getPath('userData')) }
        },
        {
          label: i18n.t('openRepoDir'),
          click: () => { shell.openPath(store.get('ipfsConfig.path')) }
        },
        {
          label: i18n.t('openConfigFile'),
          click: () => { shell.openPath(store.path) }
        },
        { type: 'separator' },
        {
          id: 'runGarbageCollector',
          label: i18n.t('runGarbageCollector'),
          click: () => { runGarbageCollector(ctx) },
          enabled: false
        },
        { type: 'separator' },
        {
          id: 'moveRepositoryLocation',
          label: i18n.t('moveRepositoryLocation'),
          click: () => { moveRepositoryLocation(ctx) }
        },
        {
          id: 'setCustomBinary',
          label: i18n.t('setCustomIpfsBinary'),
          click: () => { setCustomBinary(ctx) },
          visible: false
        },
        {
          id: 'clearCustomBinary',
          label: i18n.t('clearCustomIpfsBinary'),
          click: () => { clearCustomBinary(ctx) },
          visible: false
        }
      ]
    },
    {
      label: i18n.t('about'),
      submenu: [
        {
          label: i18n.t('versions'),
          enabled: false
        },
        {
          label: `ipfs-desktop ${VERSION}`,
          click: () => { shell.openExternal(`https://github.com/ipfs-shipyard/ipfs-desktop/releases/v${VERSION}`) }
        },
        {
          label: hasCustomBinary()
            ? i18n.t('customIpfsBinary')
            : `kubo ${GO_IPFS_VERSION}`,
          click: () => { shell.openExternal(`https://github.com/ipfs/kubo/releases/v${GO_IPFS_VERSION.replace(/^\^/, '')}`) }
        },
        { type: 'separator' },
        {
          id: 'checkForUpdates',
          label: i18n.t('checkForUpdates'),
          click: () => { ctx.manualCheckForUpdates() }
        },
        {
          id: 'checkingForUpdates',
          label: i18n.t('checkingForUpdates'),
          enabled: false
        },
        { type: 'separator' },
        {
          label: i18n.t('viewOnGitHub'),
          click: () => { shell.openExternal('https://github.com/ipfs-shipyard/ipfs-desktop/blob/master/README.md') }
        },
        {
          label: i18n.t('helpUsTranslate'),
          click: () => { shell.openExternal('https://www.transifex.com/ipfs/public/') }
        }
      ]
    },
    {
      label: i18n.t('quit'),
      click: () => { app.quit() },
      accelerator: IS_MAC ? 'Command+Q' : null
    }
  ])
}

const on = 'on'
const off = 'off'

function icon (status) {
  const dir = path.resolve(path.join(__dirname, '../assets/icons/tray'))

  if (IS_MAC) {
    return path.join(dir, 'macos', `${status}-22Template.png`)
  }

  const bw = store.get(CONFIG_KEYS.MONOCHROME_TRAY_ICON, false)
  if (bw) {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    return path.join(dir, 'others', `${status}-32-${theme}.png`)
  } else {
    return path.join(dir, 'others', `${status}-large.png`)
  }
}

// Ok this one is pretty ridiculous:
// Tray must be global or it will break due to GC:
// https://www.electronjs.org/docs/faq#my-apps-tray-disappeared-after-a-few-minutes
let tray = null

module.exports = function (ctx) {
  logger.info('[tray] starting')
  tray = new Tray(icon(off))
  let menu = null

  const state = {
    status: null,
    gcRunning: false,
    isUpdating: false
  }

  // macOS tray drop files
  tray.on('drop-files', async (_, files) => {
    await addToIpfs(ctx, files)
    ctx.launchWebUI('/files', { focus: false })
  })

  const popupMenu = (event) => {
    // https://github.com/ipfs-shipyard/ipfs-desktop/issues/1762 ¯\_(ツ)_/¯
    if (event && typeof event.preventDefault === 'function') event.preventDefault()

    tray.popUpContextMenu()
  }

  if (!IS_MAC) {
    // Show the context menu on left click on other
    // platforms than macOS.
    tray.on('click', popupMenu)
  }
  tray.on('right-click', popupMenu)
  tray.on('double-click', () => ctx.launchWebUI('/'))

  const setupMenu = () => {
    menu = buildMenu(ctx)

    tray.setContextMenu(menu)
    tray.setToolTip('IPFS Desktop')

    menu.on('menu-will-show', () => { ipcMain.emit(ipcMainEvents.MENUBAR_OPEN) })
    menu.on('menu-will-close', () => { ipcMain.emit(ipcMainEvents.MENUBAR_CLOSE) })

    updateMenu()
  }

  const updateMenu = () => {
    const { status, gcRunning, isUpdating } = state
    const errored = status === STATUS.STARTING_FAILED || status === STATUS.STOPPING_FAILED

    menu.getMenuItemById('ipfsIsStarting').visible = status === STATUS.STARTING_STARTED && !gcRunning && !isUpdating
    menu.getMenuItemById('ipfsIsRunning').visible = status === STATUS.STARTING_FINISHED && !gcRunning && !isUpdating
    menu.getMenuItemById('ipfsIsStopping').visible = status === STATUS.STOPPING_STARTED && !gcRunning && !isUpdating
    menu.getMenuItemById('ipfsIsNotRunning').visible = status === STATUS.STOPPING_FINISHED && !gcRunning && !isUpdating
    menu.getMenuItemById('ipfsHasErrored').visible = errored && !gcRunning && !isUpdating
    menu.getMenuItemById('runningWithGC').visible = gcRunning
    menu.getMenuItemById('runningWhileCheckingForUpdate').visible = isUpdating

    menu.getMenuItemById('startIpfs').visible = status === STATUS.STOPPING_FINISHED
    menu.getMenuItemById('stopIpfs').visible = status === STATUS.STARTING_FINISHED
    menu.getMenuItemById('restartIpfs').visible = (status === STATUS.STARTING_FINISHED || errored)

    menu.getMenuItemById('webuiStatus').enabled = status === STATUS.STARTING_FINISHED
    menu.getMenuItemById('webuiFiles').enabled = status === STATUS.STARTING_FINISHED
    menu.getMenuItemById('webuiPeers').enabled = status === STATUS.STARTING_FINISHED
    menu.getMenuItemById('webuiNodeSettings').enabled = status === STATUS.STARTING_FINISHED

    menu.getMenuItemById('startIpfs').enabled = !gcRunning
    menu.getMenuItemById('stopIpfs').enabled = !gcRunning
    menu.getMenuItemById('restartIpfs').enabled = !gcRunning

    menu.getMenuItemById(CONFIG_KEYS.AUTO_LAUNCH).enabled = supportsLaunchAtLogin()
    menu.getMenuItemById('takeScreenshot').enabled = status === STATUS.STARTING_FINISHED

    menu.getMenuItemById('moveRepositoryLocation').enabled = !gcRunning && status !== STATUS.STOPPING_STARTED
    menu.getMenuItemById('runGarbageCollector').enabled = menu.getMenuItemById('ipfsIsRunning').visible && !gcRunning

    menu.getMenuItemById('setCustomBinary').visible = !hasCustomBinary()
    menu.getMenuItemById('clearCustomBinary').visible = hasCustomBinary()

    menu.getMenuItemById('checkForUpdates').enabled = !isUpdating
    menu.getMenuItemById('checkForUpdates').visible = !isUpdating
    menu.getMenuItemById('checkingForUpdates').visible = isUpdating

    if (status === STATUS.STARTING_FINISHED) {
      tray.setImage(icon(on))
    } else {
      tray.setImage(icon(off))
    }

    // Update configuration checkboxes.
    for (const key of Object.values(CONFIG_KEYS)) {
      const enabled = store.get(key, false)
      const item = menu.getMenuItemById(key)
      if (item) {
        // Not all items are present in all platforms.
        item.checked = enabled
      }
    }

    if (!IS_MAC && !IS_WIN) {
      // On Linux, in order for changes made to individual MenuItems to take effect,
      // you have to call setContextMenu again - https://electronjs.org/docs/api/tray
      tray.setContextMenu(menu)
    }
  }

  ipcMain.on(ipcMainEvents.IPFSD, status => {
    state.status = status
    updateMenu()
  })

  ipcMain.on(ipcMainEvents.GC_RUNNING, () => {
    state.gcRunning = true
    updateMenu()
  })

  ipcMain.on(ipcMainEvents.GC_ENDED, () => {
    state.gcRunning = false
    updateMenu()
  })

  ipcMain.on(ipcMainEvents.UPDATING, () => {
    state.isUpdating = true
    updateMenu()
  })

  ipcMain.on(ipcMainEvents.UPDATING_ENDED, () => {
    state.isUpdating = false
    updateMenu()
  })

  ipcMain.on(ipcMainEvents.CONFIG_UPDATED, () => { updateMenu() })
  ipcMain.on(ipcMainEvents.LANG_UPDATED, () => { setupMenu() })

  nativeTheme.on('updated', () => {
    updateMenu()
  })

  setupMenu()

  createToggler(CONFIG_KEYS.MONOCHROME_TRAY_ICON, async ({ newValue }) => {
    store.set(CONFIG_KEYS.MONOCHROME_TRAY_ICON, newValue)
    return true
  })

  ctx.tray = tray
  logger.info('[tray] started')
}
