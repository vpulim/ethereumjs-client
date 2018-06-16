'use strict'

const EventEmitter = require('events')
const ProtocolSender = require('./protocolsender')
const assert = require('assert')

class Protocol extends EventEmitter {
  constructor (sender) {
    super()

    assert(sender instanceof ProtocolSender, 'sender must be a ProtocolSender')
    this._sender = sender
    this._sender.on('message', message => this.emit('message', message))
  }

  get name () {
    this.constructor.name
  }

  get sender () {
    return this._sender
  }
}

module.exports = Protocol
