'use strict'

const BlockWriter = require('./blockwriter')

/**
 * Writes headers to chain
 * @memberof module:sync/writer
 */
class HeaderWriter extends BlockWriter {
  _write (headers, encoding, cb) {
    this.chain.putHeaders(headers)
      .then(() => {
        this.emit('write', headers)
        cb()
      })
      .catch(cb)
  }
}

module.exports = HeaderWriter
