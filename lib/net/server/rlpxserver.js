'use strict'

const Server = require('./server')
const { randomBytes } = require('crypto')
const devp2p = require('ethereumjs-devp2p')
const Peer = require('../peer')
const Protocol = require('../protocol').Protocol
const ProtocolSender = require('../protocol').ProtocolSender
const assert = require('assert')
const defaultLogger = require('../../logging').defaultLogger

const capabilities = [
  devp2p.ETH.eth63
]

const defaultOptions = {
  logger: defaultLogger,
  maxPeers: 25,
  localPort: null,
  privateKey: randomBytes(32),
  clientFilter: ['go1.5', 'go1.6', 'go1.7', 'quorum', 'pirl', 'ubiq', 'gmc', 'gwhale', 'prichain'],
  refreshInterval: 30000,
  bootnodes: []
}

const ignoredErrors = new RegExp([
  'NetworkId mismatch',
  'ECONNRESET',
  'Timeout error: ping',
  'Genesis block mismatch'
].join('|'))

class RlpxProtocolSender extends ProtocolSender {
  constructor (rlpxProtocol) {
    super()

    this.sender = rlpxProtocol
    this.sender.on('status', (status) => {
      this.emit('status', status)
    })
    this.sender.on('message', (code, payload) => {
      this.emit('message', { code, payload })
    })
  }

  sendStatus (status) {
    this.sender.sendStatus(status)
  }

  sendMessage (code, rlpEncodedData) {
    this.sender._send(code, rlpEncodedData)
  }
}

class RlpxServer extends Server {
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}

    this.logger = options.logger
    this.maxPeers = options.maxPeers
    this.localPort = options.localPort
    this.privateKey = options.privateKey
    this.clientFilter = options.clientFilter
    this.refreshInterval = options.refreshInterval
    this.bootnodes = options.bootnodes
    this.init()
  }

  get name () {
    return 'rlpx'
  }

  init () {
    this.dpt = null
    this.rlpx = null
    this.peers = new Map()
    this.opened = false
  }

  async open () {
    if (this.opened) {
      return
    }

    this._initDpt()
    this._initRlpx()

    await Promise.all(this.bootnodes.map(node => {
      const bootnode = {
        address: node.ip,
        udpPort: node.port,
        tcpPort: node.port
      }
      return this.dpt.bootstrap(bootnode).catch(e => this.error(e))
    }))

    this.opened = true
  }

  ban (peerId, maxAge = 60000) {
    assert(this.opened, 'Server is not opened.')
    this.dpt.banPeer(peerId, maxAge)
  }

  error (error, peer) {
    if (ignoredErrors.test(error.message)) {
      this.logger.debug(`Ignored error: ${error.message} ${peer || ''}`)
      return
    }
    if (peer) {
      peer.emit('error', error)
    } else {
      this.emit('error', error)
    }
  }

  _initDpt () {
    this.dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: this.refreshInterval,
      endpoint: {
        address: '0.0.0.0',
        udpPort: null,
        tcpPort: null
      }
    })

    this.dpt.on('error', e => this.error(e))
  }

  _initRlpx () {
    this.rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: this.dpt,
      maxPeers: this.maxPeers,
      capabilities: capabilities,
      remoteClientIdFilter: this.clientFilter,
      listenPort: this.localPort
    })

    this.rlpx.on('peer:added', (rlpxPeer) => {
      const peer = new Peer({
        id: rlpxPeer.getId().toString('hex'),
        address: `${rlpxPeer._socket.remoteAddress}:${rlpxPeer._socket.remotePort}`,
        type: 'rlpx',
        server: this
      })
      for (let rlpxProtocol of rlpxPeer.getProtocols()) {
        const name = rlpxProtocol.constructor.name.toLowerCase()
        const sender = new RlpxProtocolSender(rlpxProtocol)
        const SubProtocol = Protocol.fromName(name)
        if (SubProtocol) {
          peer.addProtocol(new SubProtocol(sender))
        }
      }
      this.peers.set(peer.id, peer)
      this.logger.debug(`Peer connected: ${peer}`)
      this.emit('connected', peer)
    })

    this.rlpx.on('peer:removed', (rlpxPeer) => {
      const id = rlpxPeer.getId().toString('hex')
      const peer = this.peers.get(id)
      if (peer) {
        this.peers.delete(peer.id)
        this.logger.debug(`Peer disconnected: ${peer}`)
        this.emit('disconnected', peer)
      } else {
        this.logger.warn(`Tried to remove unknown peer: ${id}`)
      }
    })

    this.rlpx.on('peer:error', (rlpxPeer, error) => {
      const id = rlpxPeer.getId().toString('hex')
      const peer = this.peers.get(id)
      this.error(error, peer)
    })

    this.rlpx.on('error', e => this.error(e))
  }
}

module.exports = RlpxServer
