const EventEmitter = require('events')
const Protocol = require('../protocol').Protocol
const assert = require('assert')

class Peer extends EventEmitter {
  constructor () {
    super()

    this._protocols = {}
  }

  get protocols () {
    return Object.keys(this._protocols)
  }

  get transport () {
    return 'unknown'
  }

  get properties () {
    return {}
  }

  addProtocol (name, protocol) {
    assert(typeof name === 'string', 'name must be a string')
    assert(protocol instanceof Protocol, 'protocol must be an instance of Protocol')
    this._protocols[name] = protocol
    Object.defineProperty(this, name, {
      get: () => protocol
    })
  }

  toString () {
    const properties = Object.assign({}, this.properties, {
      protocols: this.protocols
    })
    return Object.entries(properties)
      .map(keyValue => keyValue.join('='))
      .join(' ')
  }
}

module.exports = Peer
