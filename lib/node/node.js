'use strict'

const EventEmitter = require('events')
const assert = require('assert')

/**
 * Node
 * Base class for every Ethereum node type
 * @alias module:node.Node
 * @extends EventEmitter
 * @abstract
 */

class Node extends EventEmitter {
  /**
   * Creates a new node object.
   * @constructor
   * @param {Object} options
   */

   constructor (options) {
     super()

     this.logger = options.logger
     this._init()
   }

   _init () {
   }

   async open () {
   }

   async sync () {
   }
}

module.exports = Node
