'use strict'

const EventEmitter = require('events')

class PeerPool extends EventEmitter {

  constructor (options) {
    super()

    this.servers = options.servers
    this.logger = options.logger
    this._init()
  }

  _init () {
    this._opened = false
  }

  async open () {
    if (this._opened) {
      return
    }
    await new Promise.all(this.servers.map(server => {
      server.on('peer:added', peer => this.add(peer))
      server.on('peer:removed', peer => this.remove(peer))
      server.on('peer:error', (peer, error) => this.error(error, peer))
      server.on('error', error => this.error(error))
      server.open()
    }))
    this._peers = new Map()
    this._opened = true
  }

  get peers () {
    return Array.from(this._peers.values())
  }

  filter (peer) {
    return true
  }

  add (peer) {
    if (!this.filter(peer)) {
      return
    }
    this._peers.set(peer.id, peer)
    this.emit('added', peer)
  }

  remove (peer) {
    this._peers.remove(peer.id)
    this.emit('removed', peer)
  }

  error (error, peer) {
    if (peer) {
      this.logger.warn(`${error}: ${peer}`)
    } else {
      this.emit('error', error)
    }
  }
}
