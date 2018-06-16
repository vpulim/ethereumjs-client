const EventEmitter = require('events')

class PeerSet extends EventEmitter {

  constructor (options) {
    this.chain = options.chain
    this.transports = options.transports
  }

  async open () {
    // discover peers until minPeers found
  }

  addPeer () {
  }

  removePeer () {
  }

  async sync () {

  }

}
