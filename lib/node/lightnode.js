'use strict'

const Node = require('./node')
const Blockchain = require('ethereumjs-blockchain')
const LightSync = require('./lib/sync/lightsync')

/**
 * LightNode
 * Ethereum node that implements the light sync protocol
 * @alias module:node.LightNode
 * @extends Node
 */

class LightNode extends Node {
  /**
   * Creates a new light sync node.
   * @constructor
   * @param {Object} options
   */

   constructor (options) {
     super(options)

     this.chain = new BlockChain({
       db: this.db
     })

     this.pool = new LightPeerSet({
       chain: this.chain,
       transports: this.transports
     })
   }

   async open () {
     await super.open()
     this.logger.info('Light client started')
   }
}

module.exports = LightNode
