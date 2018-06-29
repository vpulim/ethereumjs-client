'use strict'

const Node = require('./node')
const PeerPool = require('../net/peerpool')
const { FastSynchronizer } = require('../sync')

class FastSyncNode extends Node {
  constructor (options) {
    super(options)

    this.pool = new PeerPool({
      logger: this.logger,
      servers: this.servers,
      protocols: [ 'eth' ]
    })

    this.synchronizer = new FastSynchronizer({
      logger: this.logger,
      pool: this.pool,
      chain: this.chain
    })
  }

  async open () {
    if (this.opened) {
      return
    }
    await super.open()
    this.pool.on('connected', peer => this.handshake(peer))
    await this.synchronizer.open()
    this.opened = true
  }

  async sync () {
    await this.synchronizer.sync()
  }

  async handshake (peer) {
    try {
      await peer.eth.handshake(this.chain)
      this.pool.add(peer)
    } catch (e) {
      this.logger.debug(`${e.message} ${peer}`)
    }
  }
}

module.exports = FastSyncNode
