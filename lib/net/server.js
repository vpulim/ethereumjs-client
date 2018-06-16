const EventEmitter = require('events')

class Server extends EventEmitter {
  constructor (options) {
    super()

    this.transports = options.transports
    this._init()
  }

  _init () {
    for (let transport of this.transports) {
      transport.on('peer:added', peer => {
        this.emit('peer:added', peer)
      })
      transport.on('peer:error', peer => {
        this.emit('peer:error', peer)
      })
      transport.on('error', err => {
        this.emit('error', err)
      })
    }
    this._opened = false
  }

  async open () {
    return Promise.all(this.transports.map(t => t.open())).catch(err => {
      this.emit('error', err)
    })
  }
}

module.exports = Server
