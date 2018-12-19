'use strict'

const Synchronizer = require('./sync')
const { BlockFetcher } = require('./fetcher')
const { Writable } = require('stream')
const BN = require('ethereumjs-util').BN

function short (buffer) {
  return buffer.toString('hex').slice(0, 8) + '...'
}

/**
 * Implements an ethereum fast sync synchronizer
 * @memberof module:sync
 */
class FastSynchronizer extends Synchronizer {
  /**
   * Returns synchronizer type
   * @return {string} type
   */
  get type () {
    return 'fast'
  }

  /**
   * Returns true if peer can be used to fetch blocks
   * @return {boolean}
   */
  fetchable (peer) {
    return peer.eth
  }

  /**
   * Finds the peer (origin) containing the highest total difficulty. We will
   * synchronize to this peer's blockchain. Returns a promise that resolves once
   * an origin peer is found.
   * @return {Promise} Resolves with peer and height
   */
  async origin () {
    let origin
    let height
    const peers = this.pool.peers.filter(this.fetchable.bind(this))
    if (!peers.length) return
    for (let peer of peers) {
      const td = peer.eth.status.td
      if ((!origin && td.gte(this.chain.blocks.td)) ||
          (origin && origin.eth.status.td.lt(td))) {
        origin = peer
      }
    }
    try {
      if (origin) {
        const headers = await origin.eth.getBlockHeaders({
          block: origin.eth.status.bestHash, max: 1
        })
        height = new BN(headers[0].number)
        return { peer: origin, height }
      }
    } catch (error) {
      this.pool.ban(origin)
      this.logger.debug(`Error getting peer height: ${origin} ${error.stack}`)
    }
    return null
  }

  /**
   * Fetch all blocks from current height up to highest found amongst peers.
   * @return {Promise} Resolves with false if unable to fetch
   */
  async fetchBlocks () {
    const remote = await this.origin()
    const first = this.chain.blocks.height.addn(1)
    const count = remote ? remote.height.sub(first).addn(1) : new BN(0)
    const chain = this.chain
    const logger = this.logger
    if (count.lten(0)) return false

    this.logger.info(`Using origin peer: ${remote.peer.toString(true)} height=${remote.height.toString(10)}`)

    return new Promise((resolve, reject) => {
      const blockWriter = new Writable({
        objectMode: true,
        async write (blocks, encoding, cb) {
          const first = new BN(blocks[0].header.number)
          const hash = short(blocks[0].hash())
          try {
            await chain.putBlocks(blocks)
            logger.info(`Imported blocks count=${blocks.length} number=${first.toString(10)} hash=${hash}`)
            cb()
          } catch (error) {
            cb(error)
          }
        }
      })
      blockWriter.on('finish', () => {
        blockWriter.destroy()
        this.blockFetcher.destroy()
        delete this.blockFetcher
        resolve(true)
      })

      this.blockFetcher = new BlockFetcher({
        pool: this.pool,
        logger: this.logger,
        first,
        count
      })
      this.blockFetcher.on('error', (error) => this.emit('error', error))
      this.blockFetcher.pipe(blockWriter)
      this.blockFetcher.start()
    })
  }

  /**
   * Fetch entire recent state trie.
   * @return {Promise} Resolves with false if unable to fetch
   */
  async fetchState () {
    // TO DO
    return true
  }

  /**
   * Fetch all blocks from current height up to highest found amongst peers and
   * fetch entire recent state trie
   * @return {Promise} Resolves with false if unable to sync
   */
  async fetch () {
    return (await Promise.all([
      this.fetchBlocks(),
      this.fetchState()
    ])).every(x => x)
  }

  /**
   * Chain was updated
   * @param  {Object[]} announcements new block hash announcements
   * @param  {Peer}     peer peer
   * @return {Promise}
   */
  async announced (announcements, peer) {
    if (announcements.length) {
      const [hash, height] = announcements[announcements.length - 1]
      this.logger.info(`New height: number=${height.toString(10)} hash=${short(hash)}`)
      // TO DO: download new blocks
    }
  }

  /**
   * Open synchronizer. Must be called before sync() is called
   * @return {Promise}
   */
  async open () {
    await this.chain.open()
    await this.pool.open()
    const number = this.chain.blocks.height.toString(10)
    const td = this.chain.blocks.td.toString(10)
    const hash = this.chain.blocks.latest.hash()
    this.logger.info(`Latest local block: number=${number} td=${td} hash=${short(hash)}`)
  }

  /**
   * Stop synchronization. Returns a promise that resolves once its stopped.
   * @return {Promise}
   */
  async stop () {
    if (!this.running) {
      return false
    }
    if (this.blockFetcher) {
      await this.blockFetcher.stop()
    }
    super.stop()
  }
}

module.exports = FastSynchronizer
