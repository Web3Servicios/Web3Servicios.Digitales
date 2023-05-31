// @ts-check
const Countly = require('countly-sdk-nodejs')
const { ipcMain } = require('electron')
const { COUNTLY_KEY } = require('../common/consts')
const { join } = require('path')
const { app } = require('electron')
const { existsSync, mkdirSync } = require('fs')
const ipcMainEvents = require('../common/ipc-main-events')

module.exports = async function (ctx) {
  // workaround: recursive mkdir https://github.com/Countly/countly-sdk-nodejs/pull/14
  const countlyDataDir = join(app.getPath('userData'), 'countly-data')
  if (!existsSync(countlyDataDir)) {
    mkdirSync(countlyDataDir, { recursive: true })
  }

  Countly.init({
    url: 'https://countly.ipfs.io',
    app_key: COUNTLY_KEY,
    debug: process.env.DEBUG_COUNTLY === 'true',
    require_consent: true,
    // countlyDataDir for read-only node_modules
    storage_path: countlyDataDir
  })

  ctx.countlyDeviceId = Countly.device_id

  ipcMain.on(ipcMainEvents.COUNTLY_ADD_CONSENT, (_, consent) => {
    Countly.add_consent(consent)
  })

  ipcMain.on(ipcMainEvents.COUNTLY_REMOVE_CONSENT, (_, consent) => {
    Countly.remove_consent(consent)
  })
}
