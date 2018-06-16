'use strict'

const Protocol = require('./protocol')
const CODES = require('ethereumjs-devp2p').ETH.MESSAGE_CODES

class EthProtocol extends Protocol {
  constructor (sender) {
    super(sender)

    this._init()
  }

  static get name () {
    return 'eth'
  }

  static get version () {
    return 63
  }

  _init () {
    this._status = null
    this._timeout = 10000
    this.on('message', message => this.handle(message))
  }

  async handshake (chain) {
    if (this._status) {
      return
    }

    this.sender.sendStatus({
      networkId: chain.networkId,
      td: chain.td,
      bestHash: chain.latestBlock.hash(),
      genesisHash: chain.genesis.hash()
    })
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(`Handshake timed out after ${this._timeout}ms`)
      }, this._timeout)

      this.sender.once('status', (status) => {
        this._status = status
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  getBlockHeaders (block, maxHeaders, skip, reverse) {
    this.sender.sendMessage(CODES.GET_BLOCK_HEADERS, [
      block,
      maxHeaders,
      skip,
      reverse
    ])
  }

  getBlockBodies (hashes) {
    this.sender.sendMessage(CODES.GET_BLOCK_BODIES, hashes)
  }

  handle (message) {

  }
}

module.exports = EthProtocol
