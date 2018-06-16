const EventEmitter = require('events')

class Transport extends EventEmitter {
    constructor () {
      super()
    }

    open () {
      throw new Error('Unimplemented')
    }
}

module.exports = Transport
