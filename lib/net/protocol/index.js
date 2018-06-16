'use strict'

exports.Protocol = require('./protocol')
exports.ProtocolSender = require('./protocolsender')

const protocols = [
  exports.EthProtocol = require('./ethprotocol')
]

const protocolMap = new Map(protocols.map(P => [ P.name, P ]))

Object.assign(exports.Protocol, {
  fromName (name) {
    return protocolMap.get(name)
  }
});
