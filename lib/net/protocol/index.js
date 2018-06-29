'use strict'

exports.Protocol = require('./protocol')
exports.EthProtocol = require('./ethprotocol')
exports.ProtocolSender = require('./protocolsender')


const protocols = {
  'eth': exports.EthProtocol
}

Object.assign(exports.Protocol, {
  fromName (name) {
    return protocols[name]
  }
})
