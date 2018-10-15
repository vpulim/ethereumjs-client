'use strict'

const Peer = require('./peer')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Libp2pNode = require('./libp2pnode')
const { Libp2pSender } = require('../protocol')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const { promisify } = require('util')

/**
 * Libp2p peer
 * @memberof module:net/peer
 * @example
 *
 * const { Libp2pPeer } = require('./lib/net/peer')
 * const { Chain } = require('./lib/blockchain')
 * const { EthProtocol } = require('./lib/net/protocol')
 *
 * const chain = new Chain()
 * const protocols = [ new EthProtocol({ chain })]
 * const addr = '/ip4/192.0.2.1/tcp/12345'
 *
 * new Libp2pPeer({ addr, protocols })
 *   .on('error', (err) => console.log('Error:', err))
 *   .on('connected', () => console.log('Connected'))
 *   .on('disconnected', (reason) => console.log('Disconnected:', reason))
 *   .connect()
 */
class Libp2pPeer extends Peer {
  /**
   * Create new libp2p peer
   * @param {Object} options constructor parameters
   * @param {string} options.id peer id
   * @param {string} options.host peer hostname or ip address
   * @param {number} options.port peer port
   * @param {Protocols[]} [options.protocols=[]] supported protocols
   * @param {Logger} [options.logger] Logger instance
   */
  constructor (options) {
    super({ ...options, address: `${options.host}:${options.port}` })

    this.host = options.host
    this.port = options.port
    this.server = null
    this.connected = false
  }

  /**
   * Initiate peer connection
   * @return {Promise}
   */
  async connect () {
    if (this.connected) {
      return
    }
    await Promise.all(this.protocols.map(p => p.open()))
    const nodeInfo = await promisify(PeerInfo.create)()
    nodeInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')
    const peerId = PeerId.createFromB58String(this.id)
    const peerInfo = await promisify(PeerInfo.create)(peerId)
    peerInfo.multiaddrs.add(`/ip4/${this.host}/tcp/${this.port}/ipfs/${this.id}`)
    const node = new Libp2pNode({ peerInfo: nodeInfo })
    await promisify(node.start.bind(node))()

    node.on('peer:connect', info => {
      console.log('Connection established to:', info.id.toB58String())
      console.log(info.multiaddrs.toArray().map(ma => ma.toString()))
    })

    await promisify(node.dial.bind(node))(peerInfo)

  }
}

module.exports = Libp2pPeer
