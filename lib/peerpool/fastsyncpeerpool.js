'use strict'

const PeerPool = require('./peerpool')
const EthProtocol = require('../protocol').EthProtocol

class FastSyncPeerPool extends PeerPool {
  constructor (options) {
    super(options)

    this.chain = options.chain
  }

  async open () {
    await this.chain.open()
    this.on('added', peer => this.sync(peer))
  }

  filter (peer) {
    return peer.eth instanceof EthProtocol
  }

  async sync (peer) {

  }
}
