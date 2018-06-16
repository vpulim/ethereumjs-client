exports.Protocol = require('./protocol')

const protocols = [
  exports.EthProtocol = require('./ethprotocol'),
  exports.LesProtocol = require('./lesprotocol')
]

const protocolMap = new Map(protocols.map(P => [ P.name, P ]))

Object.assign(exports.Protocol, {
  fromName (name) {
    return protocolMap.get(name)
  }
});
