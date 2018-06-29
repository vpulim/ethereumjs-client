'use strict'

const EventEmitter = require('events')
const defaultLogger = require('../logging').defaultLogger

const defaultOptions = {
  logger: defaultLogger,
  servers: [],
  protocols: []
}

class PeerPool extends EventEmitter {
  constructor (options) {
    super()

    options = {...defaultOptions, ...options}

    this.servers = options.servers
    this.logger = options.logger
    this.protocols = options.protocols
    this.pool = new Map()
    this.init()
  }

  init () {
    this.opened = false
  }

  async open () {
    if (this.opened) {
      return
    }
    await Promise.all(this.servers.map(server => {
      server.on('connected', (peer) => { this.connected(peer) })
      server.on('disconnected', (peer) => { this.disconnected(peer) })
      server.on('error', (error) => this.error(error))
      server.open()
    }))
    this.opened = true
  }

  get peers () {
    return Array.from(this.pool.values())
  }

  idle () {
    const idle = this.peers.filter(p => p.idle)
    const index = Math.floor(Math.random() * idle.length)
    return idle[index]
  }

  filter (peer) {
    if (Array.isArray(this.protocols)) {
      for (let protocol of this.protocols) {
        if (!peer.understands(protocol)) return false
      }
    }
    return true
  }

  connected (peer) {
    if (!this.filter(peer)) {
      this.logger.debug(`Ignored Peer: ${peer}`)
      return
    }
    this.emit('connected', peer)
  }

  disconnected (peer) {
    if (peer) {
      this.remove(peer)
      this.emit('disconnected', peer)
    }
  }

  ban (peer, maxAge) {
    peer.server.ban(peer.id, maxAge)
    this.remove(peer)
    this.emit('banned', peer)
  }

  error (error, peer) {
    this.emit('error', error)
  }

  add (peer) {
    if (peer && peer.id) {
      this.pool.set(peer.id, peer)
      peer.on('message', (message, protocol) => {
        if (this.pool.get(peer.id)) {
          this.emit('message', message, protocol, peer)
          this.emit(`message:${protocol}`, message, peer)
        }
      })
      peer.on('error', (error, protocol) => {
        if (this.pool.get(peer.id)) {
          this.logger.warn(`Peer error: ${error} ${peer}`)
          this.ban(peer)
        }
      })
      this.emit('added', peer)
    }
  }

  remove (peer) {
    if (peer && peer.id) {
      if (this.pool.delete(peer.id)) {
        this.emit('removed', peer)
      }
    }
  }
}

module.exports = PeerPool
