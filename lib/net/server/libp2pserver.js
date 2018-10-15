'use strict'

const Server = require('./server')
const PeerInfo = require('peer-info')
const { Libp2pPeer, Libp2pNode } = require('../peer')
const { promisify } = require('util')

const defaultOptions = {
  localPort: null,
  privateKey: null,
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
   * @param {number}   [options.localPort=null] local port to listen on
   * @param {Buffer}   [options.privateKey] private key to use for server
   * @param {number}   [options.refreshInterval=30000] how often (in ms) to discover new peers
   * @param {Logger}   [options.logger] Logger instance
   */
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}

    this.localPort = options.localPort
    this.privateKey = options.privateKey
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
      const nodeInfo = await promisify(PeerInfo.create)()
      nodeInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')
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
