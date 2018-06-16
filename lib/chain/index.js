'use strict'

const fs = require('fs')
const path = require('path')
const levelup = require('levelup')
const leveldown = require('leveldown')
const Blockchain = require('ethereumjs-blockchain')

class Chain extends EventEmitter {
  constructor (options) {
    this.logger = options.logger
    this._dataDir = options.dataDir
    this._init()
  }

  _init () {
    _initializeDatadir()
    this._blockchain = new Blockchain({
      db: levelup(this._dataDir, { db: leveldown }),
      validate: false
    })
    this._latest = {
      header: null,
      block: null
    }
    this._opened = false
  }

  get latest () {
    return this._latest
  }

  async open () {
    if (this._opened) {
      return
    }

    await this.update()

    this._opened = true
  }

  async update () {
    const updateLatestHeader = new Promise((resolve, reject) => {
      this._blockchain.getLatestHeader((err, header) => {
        if (err) return reject(err)
        this._latest.header = header
        resolve()
      })
    })
    const updateLatestBlock = new Promise((resolve, reject) => {
      this._blockchain.getLatestBlock((err, block) => {
        if (err) return reject(err)
        this._latest.block = block
        resolve()
      })
    })
    await new Promise.all([ updateLatestHeader, updateLatestBlock ])
    this.emit('updated')
  }

  // From: https://stackoverflow.com/a/40686853
  // replace if there is an easier solution
  _mkDirByPathSync (targetDir, {isRelativeToScript = false} = {}) {
    const sep = path.sep
    const initDir = path.isAbsolute(targetDir) ? sep : ''
    const baseDir = isRelativeToScript ? __dirname : '.'

    targetDir.split(sep).reduce((parentDir, childDir) => {
      const curDir = path.resolve(baseDir, parentDir, childDir)
      try {
        fs.mkdirSync(curDir)
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err
        }
      }
      return curDir
    }, initDir)
  }

  _initializeDatadir () {
    if (!fs.existsSync(this._dataDir)) {
      this._mkDirByPathSync(this._dataDir)
    }
    this.logger.info(`Initialized data directory: ${this._dataDir}`)
  }

  async add (blocks) {
    if (!Array.isArray(blocks)) {
      blocks = [ blocks ]
    }

    if (!blocks.length) {
      return
    }

    await new Promise((resolve, reject) => {
      this._blockchain.putBlocks(blocks, err => err ? reject(err) : resolve())
    })

    await update()
  }
}
