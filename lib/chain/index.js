'use strict'

const fs = require('fs-extra')
const path = require('path')
const levelup = require('levelup')
const leveldown = require('leveldown')
const EventEmitter = require('events')
const Common = require('ethereumjs-common')
const Blockchain = require('ethereumjs-blockchain')
const BN = require('ethereumjs-util').BN
const defaultLogger = require('../logging').defaultLogger

const defaultOptions = {
  logger: defaultLogger
}

function hexToBuffer(hexString) {
  if (typeof(hexString) === 'string' && hexString.startsWith('0x')) {
    return Buffer.from(hexString.slice(2), 'hex')
  }
  return hexString
}

class Chain extends EventEmitter {
  constructor (options) {
    super()
    options = {...defaultOptions, ...options}

    this.logger = options.logger
    this.common = new Common(options.network)
    this.dataDir = options.dataDir
    this.init()
  }

  init () {
    fs.ensureDirSync(this.dataDir)

    this.logger.info(`Data directory: ${this.dataDir}`)

    this.blockchain = new Blockchain({
      db: levelup(this.dataDir, { db: leveldown }),
      validate: false
    })
    this._latest = {
      block: null,
      td: new BN(0)
    }
    this._opened = false
  }

  get networkId () {
    return this.common.networkId()
  }

  get genesis () {
    const genesis = this.common.genesis()
    Object.entries(genesis).forEach(([k,v]) => genesis[k] = hexToBuffer(v))
    return genesis
  }

  get td () {
    return this._latest.td
  }

  get latest () {
    return this._latest.block
  }

  get height () {
    return new BN(this._latest.block.header.number)
  }

  async open () {
    if (this._opened) {
      return
    }

    await this.update()

    this._opened = true
  }

  async update () {
    await new Promise((resolve, reject) => {
      this.blockchain.getLatestBlock((err, block) => {
        if (err) return reject(err)
        this._latest.block = block
        resolve()
      })
    })
    await new Promise((resolve, reject) => {
      this.blockchain._getTd(this._latest.block.hash(), (err, td) => {
        if (err) return reject(err)
        this._latest.td = td
        resolve()
      })
    })

    this.emit('updated')
  }

  async add (blocks) {
    if (!Array.isArray(blocks)) {
      blocks = [ blocks ]
    }

    if (!blocks.length) {
      return
    }

    await new Promise((resolve, reject) => {
      this.blockchain.putBlocks(blocks, err => err ? reject(err) : resolve())
    })

    await update()
  }
}

module.exports = Chain
