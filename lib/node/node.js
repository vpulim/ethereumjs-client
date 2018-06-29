'use strict'

const EventEmitter = require('events')
const Chain = require('../chain')
const Server = require('../net/server').Server
const Common = require('ethereumjs-common')
const defaultLogger = require('../logging').defaultLogger

const defaultOptions = {
  logger: defaultLogger
}

class Node extends EventEmitter {
   constructor (options) {
     super()
     options = {...defaultOptions, ...options}

     this.logger = options.logger
     this.common = new Common(options.network)
     this.servers = options.transports.map(name => {
       return new (Server.fromName(name))(Object.assign({}, options, {
         bootnodes: this.common.bootstrapNodes()
       }))
     })
     this.chain = new Chain({
       logger: this.logger,
       dataDir: options.dataDir,
       network: options.network
     })
     this.pool = null
     this.opened = false
   }

   async open () {
     if (this.opened) {
       return
     }
     await Promise.all(this.servers.map(s => s.open()))
     await this.chain.open()
     if (this.pool) {
       this.pool.on('banned', peer => this.logger.debug(`Peer banned: ${peer}`))
       this.pool.on('error', error => this.logger.error(error))
       this.pool.on('added', peer => this.logger.debug(`Peer added: ${peer}`))
       this.pool.on('removed', peer => this.logger.debug(`Peer removed: ${peer}`))
       await this.pool.open()
     }
     this.opened = true
   }

   async sync () {
   }
 }

module.exports = Node
