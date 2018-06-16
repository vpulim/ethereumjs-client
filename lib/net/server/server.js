'use strict'

const EventEmitter = require('events')

class Server extends EventEmitter {
    constructor () {
      super()
    }

    open () {
      throw new Error('Unimplemented')
    }

    ban (peerId, maxAge) {
      // don't do anything by default
    }
}

module.exports = Server
