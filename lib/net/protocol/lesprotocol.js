const Protocol = require('./protocol')

class LesProtocol extends Protocol {
  constructor (senderListener) {
    super(senderListener)

    this._init()
  }

  static get name () {
    return 'les'
  }

  static get version () {
    return 2
  }

  _init () {
  }

  getHeaders () {
    this.senderListener.sendMessage(1, [])
  }
}

module.exports = LesProtocol
