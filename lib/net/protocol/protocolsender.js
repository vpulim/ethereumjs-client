'use strict'

const EventEmitter = require('events')

class ProtocolSender extends EventEmitter {
  constructor () {
    super()
  }

  sendStatus (status) {
    throw new Error('Unimplemented')
  }

  sendMessage (code, rlpEncodedData) {
    throw new Error('Unimplemented')
  }
}

module.exports = ProtocolSender
