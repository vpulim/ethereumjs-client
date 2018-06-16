const RlpxPeer = require('../peer').RlpxPeer
const Transport = require('./transport')
const { randomBytes } = require('crypto')
const devp2p = require('ethereumjs-devp2p')
const Common = require('ethereumjs-common')

const capabilitiesMap = {
  eth: devp2p.ETH.eth63,
  les: devp2p.LES.les2
}

class RlpxTransport extends Transport {
  constructor (options) {
    super(options)

    this.protocols = options.protocols
    this.maxPeers = options.maxPeers || 25
    this.localPort = options.localPort || null
    this.privateKey = options.privateKey || randomBytes(32)
    this.clientIdFilter = options.clientIdFilter
    this._init()
  }

  _init () {
    this._rlpx = null
    this._peers = new Map()
    this._opened = false
  }

  async open () {
    if (this._opened) {
      return
    }

    const common = new Common('mainnet')

    const dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: {
        address: '0.0.0.0',
        udpPort: null,
        tcpPort: null
      }
    })

    dpt.on('error', e => this.emit('error', e))

    this._rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: dpt,
      maxPeers: this.maxPeers,
      capabilities: this.protocols.map(name => capabilitiesMap[name]),
      remoteClientIdFilter: this.clientIdFilter,
      listenPort: this.localPort
    })

    this._rlpx.on('peer:added', (peer) => {
      const rlpxPeer = new RlpxPeer(peer)
      this._peers.set(peer.id, rlpxPeer)
      this.emit('peer:added', rlpxPeer)
    })

    this._rlpx.on('peer:removed', (peer) => {
      const rlpxPeer = this._peers.get(peer.id)
      this._peers.delete(peer.id)
      this.emit('peer:removed', rlpxPeer)
    })

    this._rlpx.on('peer:error', (peer, err) => {
      if (rlpxPeer) this.emit('peer:error', rlpxPeer, err)
    })

    this._rlpx.on('error', e => this.emit('error', e))

    for (let node of common.bootstrapNodes()) {
      const bootnode = {
        address: node.ip,
        udpPort: node.port,
        tcpPort: node.port
      }
      dpt.bootstrap(bootnode).catch(e => this.emit('error', e))
    }
  }
}

module.exports = RlpxTransport
