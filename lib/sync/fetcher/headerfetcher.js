'use strict'

const BlockFetcher = require('./blockfetcher')

const defaultOptions = {
  maxPerRequest: 192
}

/**
 * Implements an les/1 based header fetcher
 * @memberof module:sync/fetcher
 */
class HeaderFetcher extends BlockFetcher {
  /**
   * Create new header fetcher
   * @param {Object}       options constructor parameters
   * @param {PeerPool}     options.pool peer pool
   * @param {BN}           options.first header number to start fetching from
   * @param {BN}           options.count how many headers to fetch
   * @param {FlowControl}  options.flow flow control manager
   * @param {number}       [options.timeout] fetch task timeout
   * @param {number}       [options.banTime] how long to ban misbehaving peers
   * @param {number}       [options.interval] retry interval
   * @param {number}       [options.maxPerRequest=192] max items per request
   * @param {Logger}       [options.logger] Logger instance
   */
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}
    this.flow = options.flow
  }

  /**
   * Requests block headers for the given task
   * @param  {Object} job
   * @return {Promise}
   */
  async request (job) {
    const { task, peer } = job
    if (this.flow.maxRequestCount(peer, 'GetBlockHeaders') < this.maxPerRequest) {
      // we reached our request limit. try with a different peer.
      return false
    }
    return peer.les.getBlockHeaders({ block: task.first, max: task.count })
  }

  /**
   * Process fetch result
   * @param  {Object} job fetch job
   * @param  {Object} result fetch result
   * @return {*} results of processing job or undefined if job not finished
   */
  process (job, result) {
    this.flow.handleReply(job.peer, result.bv)
    if (result.headers && result.headers.length === job.task.count) {
      return result.headers
    }
  }

  /**
   * Store fetch result. Resolves once store operation is complete.
   * @param {Header[]} headers fetch result
   * @return {Promise}
   */
  async store (headers) {
    await this.chain.putHeaders(headers)
  }

  /**
   * Returns a peer that can process the given job
   * @param  {Object} job job
   * @return {Peer}
   */
  peer (job) {
    return this.pool.idle(p => p.les && p.les.status.serveHeaders)
  }
}

module.exports = HeaderFetcher
