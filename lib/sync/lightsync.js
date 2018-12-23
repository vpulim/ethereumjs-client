'use strict'

const Synchronizer = require('./sync')
const { HeaderFetcher } = require('./fetcher')
const { HeaderWriter } = require('./writer')
const BN = require('ethereumjs-util').BN

function short (buffer) {
  return buffer.toString('hex').slice(0, 8) + '...'
}

/**
 * Implements an ethereum light sync synchronizer
 * @memberof module:sync
 */
class LightSynchronizer extends Synchronizer {
  /**
   * Returns synchronizer type
   * @return {string} type
   */
  get type () {
    return 'light'
  }

  /**
   * Returns true if peer can be used for syncing
   * @return {boolean}
   */
  syncable (peer) {
    return peer.les && peer.les.status.serveHeaders
  }

  /**
   * Finds the best peer to sync with. We will synchronize to this peer's
   * blockchain. Returns null if no valid peer is found
   * @return {Peer}
   */
  best () {
    let best
    const peers = this.pool.peers.filter(this.syncable.bind(this))
    if (!peers.length) return
    for (let peer of peers) {
      const td = peer.les.status.headTd
      if ((!best && td.gte(this.chain.headers.td)) ||
          (best && best.les.status.headTd.lt(td))) {
        best = peer
      }
    }
    return best
    // origin.les.status.headNum
  }

  /**
   * Fetch all headers from current height up to highest found amongst peers.
   * @return {Promise} Resolves with false if unable to fetch
   */
  async fetchHeaders () {
    const remote = await this.origin()
    const first = this.chain.headers.height.addn(1)
    const count = remote ? remote.height.sub(first).addn(1) : new BN(0)
    if (count.lten(0)) return false

    this.logger.debug(`Using origin peer: ${remote.peer.toString(true)} height=${remote.height.toString(10)}`)

    return new Promise((resolve, reject) => {
      const writer = new HeaderWriter({ chain: this.chain })
      this.headerFetcher = new HeaderFetcher({
        pool: this.pool,
        flow: this.flow,
        logger: this.logger,
        interval: this.interval,
        first,
        count
      })
      this.headerFetcher
        .on('error', (error) => {
          this.emit('error', error)
        })
        .pipe(writer)
        .on('write', headers => {
          const first = new BN(headers[0].number)
          const hash = short(headers[0].hash())
          this.logger.info(`Imported headers count=${headers.length} number=${first.toString(10)} hash=${hash} peers=${this.pool.size}`)
        })
        .on('finish', () => {
          delete this.headerFetcher
          resolve()
        })
        .on('error', (error) => {
          writer.destroy()
          this.headerFetcher.destroy()
          delete this.headerFetcher
          this.logger.warn(error)
          this.fetchHeaders().then(resolve)
        })
      this.headerFetcher.start()
    })
  }

  /**
   * Fetch all headers from current height up to highest found amongst peers
   * @return {Promise} Resolves with false if unable to sync
   */
  async fetch () {
    return this.fetchHeaders()
  }

  /**
   * Open synchronizer. Must be called before sync() is called
   * @return {Promise}
   */
  async open () {
    await this.chain.open()
    await this.pool.open()
    const number = this.chain.headers.height.toString(10)
    const td = this.chain.headers.td.toString(10)
    const hash = this.chain.blocks.latest.hash()
    this.logger.info(`Latest local header: number=${number} td=${td} hash=${short(hash)}`)
  }

  /**
   * Stop synchronization. Returns a promise that resolves once its stopped.
   * @return {Promise}
   */
  async stop () {
    if (!this.running) {
      return false
    }
    if (this.headerFetcher) {
      this.headerFetcher.destroy()
      delete this.headerFetcher
    }
    super.stop()
  }
}

module.exports = LightSynchronizer
