const EventEmitter = require('events')
const assert = require('assert')

class Protocol extends EventEmitter {
  constructor (senderListener) {
    if (new.target === Protocol) {
      throw new TypeError("Cannot construct Protocol instances directly")
    }
    super()
    this.validateSenderListener(senderListener)
    this.senderListener = senderListener
  }

  validateSenderListener (senderListener) {
    assert(typeof(senderListener) === 'object', 'senderListener must be defined')
    assert(typeof(senderListener.sendMessage) === 'function', 'senderListener.sendMessage must be a function')
    assert(senderListener instanceof EventEmitter, 'senderListener must be an EventEmitter')
  }
}

module.exports = Protocol
