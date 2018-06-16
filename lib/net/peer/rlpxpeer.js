const Peer = require('./peer')
const Protocol = require('../protocol').Protocol
const devp2p = require('ethereumjs-devp2p')

class RlpxPeer extends Peer {
  constructor (peer) {
    super()

    for (let protocol of peer.getProtocols()) {
      const name = this._nameFromProtocolInstance(protocol)
      const SubProtocol = Protocol.fromName(name)
      if (SubProtocol) {
        this.addProtocol(name, new SubProtocol(protocol))
      }
    }

    this._peer = peer
  }

  get transport () {
    return 'rlpx'
  }

  get properties () {
    return {
      address: this._peer._socket.remoteAddress,
      port: this._peer._socket.remotePort
    }
  }

  get native () {
    return this._peer
  }

  _nameFromProtocolInstance(protocol) {
    if (protocol instanceof devp2p.ETH) {
      return 'eth'
    } else if (protocol instanceof devp2p.LES) {
      return 'les'
    }
  }
}

module.exports = RlpxPeer
