'use strict'

const EventEmitter = require('events')
const Protocol = require('../protocol').Protocol
const assert = require('assert')

const defaultOptions = {
  protocols: []
}

class Peer extends EventEmitter {
  constructor (options) {
    super()
    options = {...defaultOptions, ...options}

    this.id = options.id
    this.address = options.address
    this.type = options.type
    this.server = options.server
    this.protocols = []

    options.protocols.forEach(p => this.addProtocol(p))
    this.init()
  }

  init () {
    this._idle = true
  }

  get idle () {
    return this._idle
  }

  set idle (value) {
    this._idle = value
  }

  addProtocol (protocol) {
    assert(protocol instanceof Protocol, 'protocol must be an instance of Protocol')
    Object.defineProperty(this, protocol.name, {
      get: () => protocol
    })
    protocol.on('message', message => {
      this.emit('message', message, protocol.name)
    })
    this.protocols.push(protocol)
  }

  understands (protocolName) {
    return !!this.protocols.find(p => p.name === protocolName)
  }

  toString () {
    const properties = {
      id: this.id.substr(0, 8),
      address: this.address,
      protocols: this.protocols.map(p => p.name),
    }
    return Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== null && value.toString() !== '')
      .map(keyValue => keyValue.join('='))
      .join(' ')
  }
}

module.exports = Peer
