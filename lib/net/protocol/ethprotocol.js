'use strict'

const Protocol = require('./protocol')
const CODES = require('ethereumjs-devp2p').ETH.MESSAGE_CODES
const util = require('ethereumjs-util')
const rlp = util.rlp
const BN = util.BN

class EthProtocol extends Protocol {
  constructor (sender) {
    super(sender)

    this.init()
  }

  static get codes () {
    return CODES
  }

  get name () {
    return 'eth'
  }

  get version () {
    return 63
  }

  get status () {
    return this._status
  }

  get td () {
    return this._status.td
  }

  get head () {
    return this._status.bestHash
  }

  init () {
    this._status = null
  }

  async handshake (chain) {
    if (this._status) {
      return
    }

    this.sender.sendStatus({
      networkId: chain.networkId,
      td: chain.td.toBuffer(),
      bestHash: chain.latest.hash(),
      genesisHash: chain.genesis.hash
    })
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        timeout = null
        reject(new Error(`Handshake timed out after ${this.timeout}ms`))
      }, this.timeout)

      this.sender.once('status', (status) => {
        this._status = {
          networkId: util.bufferToInt(status.networkId),
          td: new BN(status.td),
          bestHash: status.bestHash,
          genesisHash: status.genesisHash
        }
        // make sure we don't resolve twice if already timed out
        if (timeout) {
          clearTimeout(timeout)
          resolve(status)
        }
      })
    })
  }

  getBlockHeaders (block, maxHeaders, skip, reverse) {
    this.sender.sendMessage(CODES.GET_BLOCK_HEADERS, rlp.encode([
      block,
      maxHeaders,
      skip,
      reverse
    ]))
  }

  getBlockBodies (hashes) {
    this.sender.sendMessage(CODES.GET_BLOCK_BODIES, rlp.encode(hashes))
  }
}

module.exports = EthProtocol
