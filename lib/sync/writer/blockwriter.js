'use strict'

const { Writable } = require('stream')

/**
 * Writes blocks to chain
 * @memberof module:sync/writer
 */
class BlockWriter extends Writable {
  /**
   * Create new block writer
   * @param {Object} options constructor parameters
   * @param {Chain} options.chain blockchain
   */
  constructor (options) {
    super({ ...options, objectMode: true })
    this.chain = options.chain
  }

  _write (blocks, encoding, cb) {
    this.chain.putBlocks(blocks)
      .then(() => {
        this.emit('write', blocks)
        cb()
      })
      .catch(cb)
  }

  _writev (many, cb) {
    this._write([].concat(...many.map(x => x.chunk)), null, cb)
  }
}

module.exports = BlockWriter
