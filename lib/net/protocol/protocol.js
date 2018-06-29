'use strict'

const EventEmitter = require('events')
const ProtocolSender = require('./protocolsender')
const assert = require('assert')

class Protocol extends EventEmitter {
  constructor (sender) {
    super()

    assert(sender instanceof ProtocolSender, 'sender must be a ProtocolSender')
    this.sender = sender
    this.resolvers = new Map()
    this.timeout = 10000
    this.sender.on('message', message => this.handle(message))
  }

  handle (message) {
    const resolver = this.resolvers.get(message.code)
    if (resolver) {
      if (resolver.timeout) {
        clearTimeout(resolver.timeout)
      }
      this.resolvers.delete(message.code)
      resolver.resolve(message.payload)
    } else {
      this.emit('message', message)
    }
  }

  async response (code) {
    const resolver = {
      timeout: null,
      resolve: null
    }
    if (this.resolvers.get(code)) {
      throw new Error(`Only one active request allowed per code (${code})`)
    }
    this.resolvers.set(code, resolver)
    return new Promise((resolve, reject) => {
      resolver.timeout = setTimeout(() => {
        resolver.timeout = null
        this.resolvers.delete(code)
        reject(new Error(`Request timed out after ${this.timeout}ms`))
      }, this.timeout)
      resolver.resolve = resolve
    })
  }
}

module.exports = Protocol
