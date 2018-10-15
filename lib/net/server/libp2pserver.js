'use strict'

const Server = require('./server')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const { Libp2pNode } = require('../peer')
const { promisify } = require('util')

const defaultOptions = {
  port: 0,
  key: null,
  bootnodes: []
}

/**
 * Libp2p server
 * @emits connected
 * @emits disconnected
 * @emits error
 * @memberof module:net/server
 */
class Libp2pServer extends Server {
  /**
   * Create new DevP2P/RLPx server
   * @param {Object}   options constructor parameters
   * @param {Object[]} options.bootnodes list of bootnodes to use for discovery
   * @param {number}   [options.maxPeers=25] maximum peers allowed
   * @param {number}   [options.port=null] local port to listen on
   * @param {Buffer}   [options.key] private key to use for server
   * @param {number}   [options.refreshInterval=30000] how often (in ms) to discover new peers
   * @param {Logger}   [options.logger] Logger instance
   */
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}
    this.port = options.port
    this.key = options.key
    this.bootnodes = options.bootnodes
    this.node = null
    this.init()
  }

  /**
   * Server name
   * @type {string}
   */
  get name () {
    return 'libp2p'
  }

  init () {
    this.peers = new Map()
    if (typeof this.key === 'string') {
      this.key = Buffer.from(this.key, 'base64')
    }
  }

  /**
   * Start Libp2p server. Returns a promise that resolves once server has been started.
   * @return {Promise}
   */
  async start () {
    if (this.started) {
      return false
    }
    await super.start()
    if (!this.node) {
      let nodeInfo
      if (this.key) {
        const nodeId = await promisify(PeerId.createFromPrivKey)(this.key)
        nodeInfo = await promisify(PeerInfo.create)(nodeId)
      } else {
        nodeInfo = await promisify(PeerInfo.create)()
      }
      nodeInfo.multiaddrs.add(`/ip4/0.0.0.0/tcp/${this.port}`)
      this.node = new Libp2pNode({
        peerInfo: nodeInfo,
        bootnodes: this.bootnodes
      })
      this.node.on('peer:connect', peerInfo => {
        console.log('received dial from:', peerInfo.id.toB58String())
      })
      this.node.handle('/eth/63', (protocol, conn) => pull(conn, conn))
    }
    await promisify(this.node.start.bind(this.node))()
    this.emit('listening', {
      transport: this.name,
      url: this.node.peerInfo.multiaddrs.toArray()[0]
    })
    this.started = true
  }

  /**
   * Stop Devp2p/RLPx server. Returns a promise that resolves once server has been stopped.
   * @return {Promise}
   */
  async stop () {
    if (!this.started) {
      return false
    }

    await super.stop()
    await promisify(this.node.start.bind(this.node))()
    this.started = false
  }

  /**
   * Ban peer for a specified time
   * @param  {string} peerId id of peer
   * @param  {number} [maxAge] how long to ban peer
   * @return {Promise}
   */
  ban (peerId, maxAge = 60000) {
    if (!this.started) {
      return false
    }
    // TO DO
  }

  /**
   * Handles errors from server and peers
   * @private
   * @param  {Error} error
   * @param  {Peer} peer
   * @emits  error
   */
  error (error, peer) {
    if (ignoredErrors.test(error.message)) {
      return
    }
    if (peer) {
      peer.emit('error', error)
    } else {
      this.emit('error', error)
    }
  }
}

module.exports = Libp2pServer
