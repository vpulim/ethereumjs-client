'use strict'

exports.Server = require('./server')
exports.RlpxServer = require('./rlpxserver')

const servers = {
  'rlpx': exports.RlpxServer
}

Object.assign(exports.Server, {
  fromName (name) {
    return servers[name]
  }
})
