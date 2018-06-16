const Protocol = require('./protocol')

class EthProtocol extends Protocol {
  constructor (senderListener) {
    super(senderListener)

    this._init()
  }

  static get name () {
    return 'eth'
  }

  static get version () {
    return 63
  }

  _init () {
  }

  getHeaders () {
    this.senderListener.sendMessage(1, [])
  }
}

module.exports = EthProtocol
