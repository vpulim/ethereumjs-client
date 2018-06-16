'use strict'

const EventEmitter = require('events')
const levelup = require('levelup')
const leveldown = require('leveldown')
const fs = require('fs-extra')
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
     this.dataDir = options.dataDir
     this.protocols = [ LesProtocol ]
     this.transports = [ new Devp2pTransport(this.protocols) ]
     this.server = new Server(this.transports)
     this.pool = new LightSyncPeerPool(this.server)

     this._init()
   }

   _init () {
     fs.ensureDirSync(this.dataDir)
     this.db = levelup(this.datadir, { db: leveldown })
     this._opened = false
   }

   async open () {
     if (this._opened) {
       return
     }
     this.server.open()
     await this.pool.open()
     this.pool.sync()
   }

   async close () {
   }
}

module.exports = Node
