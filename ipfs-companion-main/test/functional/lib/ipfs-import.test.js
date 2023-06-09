'use strict'
import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { useFakeTimers } from 'sinon'
import browser from 'sinon-chrome'
import { formatImportDirectory } from '../../../add-on/src/lib/ipfs-import.js'

describe('ipfs-import.js', function () {
  before(function () {
    browser.runtime.id = 'testid'
    global.document = {}
    global.browser = browser
    // ipfs-import depends on webextension/polyfill which can't be imported
    // in a non-browser environment unless global.browser is stubbed

    // need to force Date to return a particular date
    global.clock = useFakeTimers({
      now: new Date(2017, 10, 5, 12, 1, 1)
    })
  })

  describe('formatImportDirectory', function () {
    it('should change nothing if path is properly formatted and date wildcards are not provided', function () {
      const path = '/ipfs-companion-imports/my-directory/'
      expect(formatImportDirectory(path)).to.equal('/ipfs-companion-imports/my-directory/')
    })

    it('should replace two successive slashes with a single slash', function () {
      const path = '/ipfs-companion-imports//my-directory/'
      expect(formatImportDirectory(path)).to.equal('/ipfs-companion-imports/my-directory/')
    })

    it('should replace multiple slashes with a single slash', function () {
      const path = '/ipfs-companion-imports/////////my-directory/'
      expect(formatImportDirectory(path)).to.equal('/ipfs-companion-imports/my-directory/')
    })

    it('should add trailing slash if not present', function () {
      const path = '/ipfs-companion-imports/my-directory'
      expect(formatImportDirectory(path)).to.equal('/ipfs-companion-imports/my-directory/')
    })

    it('should replace date wildcards with padded dates', function () {
      const path = '/ipfs-companion-imports/%Y-%M-%D_%h%m%s/'
      expect(formatImportDirectory(path)).to.equal('/ipfs-companion-imports/2017-11-05_120101/')
    })
  })
  // TODO: complete tests
  // describe('openFilesAtWebUI', function () {
  // })
  //
  // describe('openFilesAtGateway', function () {
  // })
  //
  // describe('importFiles', function () {
  // })

  after(function () {
    global.browser.flush()
    global.clock.restore()
    delete global.document
    delete global.browser
  })
})
