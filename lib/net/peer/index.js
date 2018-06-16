'use strict'

const EventEmitter = require('events')
const Protocol = require('../protocol').Protocol
const assert = require('assert')

class Peer extends EventEmitter {
  constructor (options) {
    super()

    this._id = options.id
    this._address = options.address
    this._type = options.type
    this._protocols = options.protocols || []
    this._server = options.server
    this._init()
  }

  get id () {
    return this._id
  }

  get type () {
    return this._type
  }

  get protocols () {
    return this._protocols
  }

  get server () {
    return this._server
  }

  _init () {
    this._protocols.forEach(this.addProtocol.bind(this))
  }

  addProtocol (protocol) {
    assert(protocol instanceof Protocol, 'protocol must be an instance of Protocol')
    Object.defineProperty(this, protocol.name, {
      get: () => protocol
    })
  }

  ban (maxAge) {
    if (this.server) {
      this.server.ban(this.id, maxAge)
    }
  }

  toString () {
    const properties = {
      id: this._id,
      address: this._address,
      protocols: this._protocols.map(p => p.name),
    })
    return Object.entries(properties)
      .map(keyValue => keyValue.join('='))
      .join(' ')
  }
}

module.exports = Peer
