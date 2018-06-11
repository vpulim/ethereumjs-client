'use strict'

const Node = require('./node')

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
   }

   async open () {
     await super.open()
     this.logger.info('Light client started')
   }
}

module.exports = LightNode
