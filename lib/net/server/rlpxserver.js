'use strict'

const Server = require('./server')
const { randomBytes } = require('crypto')
const devp2p = require('ethereumjs-devp2p')
const Common = require('ethereumjs-common')
const Protocol = require('../protocol').Protocol
const ProtocolSender = require('../protocol').ProtocolSender

const capabilitiesMap = {
  eth: devp2p.ETH.eth63,
  les: devp2p.LES.les2
}

class RlpxProtocolSender extends ProtocolSender {
  constructor (rlpxProtocol) {
    super()

    this._sender = rlpxProtocol
    this._sender.on('status', (status) => {
      this.emit('status', status)
    })
    this._sender.on('message', (code, payload) => {
      this.emit('message', { code, payload })
    })
  }

  sendStatus (status) {
    this._sender.sendStatus()
  }

  sendMessage (code, rlpEncodedData) {
    this._sender._send(code, rlpEncodedData)
  }
}

class RlpxServer extends Server {
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
    this._dpt = null
    this._rlpx = null
    this._peers = new Map()
    this._opened = false
  }

  async open () {
    if (this._opened) {
      return
    }

    const bootnodes = new Common('mainnet').bootstrapNodes()

    this._initDpt()
    this._initRlpx()

    await new Promise.all(bootnodes.map(node => {
      const bootnode = {
        address: node.ip,
        udpPort: node.port,
        tcpPort: node.port
      }
      return this._dpt.bootstrap(bootnode).catch(e => this.emit('error', e))
    }))

    this._opened = true
  }

  ban (peerId, maxAge = 60000) {
    assert(this._opened, 'Server is not opened.')
    this._dpt.banPeer(peerId, maxAge)
  }

  _initDpt () {
    this._dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: {
        address: '0.0.0.0',
        udpPort: null,
        tcpPort: null
      }
    })

    this._dpt.on('error', e => this.emit('error', e))
  }

  _initRlpx () {
    this._rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: this._dpt,
      maxPeers: this.maxPeers,
      capabilities: this.protocols.map(name => capabilitiesMap[name]),
      remoteClientIdFilter: this.clientIdFilter,
      listenPort: this.localPort
    })

    this._rlpx.on('peer:added', (rlpxPeer) => {
      const peer = new Peer({
        id: rlpxPeer.id,
        address: `${rlpxPeer._socket.remoteAddress}:${rlpxPeer._socket.remotePort}`,
        type: 'rlpx',
        server: this
      })
      for (let protocol of rlpxPeer.getProtocols()) {
        const name = this._nameFromProtocolInstance(protocol)
        const SubProtocol = Protocol.fromName(name)
        const sender = new RlpxProtocolSender(protocol)
        if (SubProtocol) {
          peer.addProtocol(new SubProtocol(sender))
        }
      }
      this._peers.set(rlpxPeer.id, peer)
      this.emit('peer:added', peer)
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
  }

  _nameFromProtocolInstance(protocol) {
    if (protocol instanceof devp2p.ETH) {
      return 'eth'
    } else if (protocol instanceof devp2p.LES) {
      return 'les'
    }
  }
}

module.exports = RlpxServer
