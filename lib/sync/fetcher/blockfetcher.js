'use strict'

const Fetcher = require('./fetcher')
const Block = require('ethereumjs-block')

const defaultOptions = {
  maxPerRequest: 128
}

/**
 * Implements an eth/62 based block fetcher
 * @memberof module:sync/fetcher
 */
class BlockFetcher extends Fetcher {
  /**
   * Create new block fetcher
   * @param {Object}       options constructor parameters
   * @param {PeerPool}     options.pool peer pool
   * @param {BN}           options.first block number to start fetching from
   * @param {BN}           options.count how many blocks to fetch
   * @param {number}       [options.timeout] fetch task timeout
   * @param {number}       [options.banTime] how long to ban misbehaving peers
   * @param {number}       [options.interval] retry interval
   * @param {number}       [options.maxPerRequest=128] max items per request
   * @param {Logger}       [options.logger] Logger instance
   */
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}
    this.maxPerRequest = options.maxPerRequest
    this.first = options.first
    this.count = options.count
    this.init()
  }

  init () {
    let { first, count } = this
    const max = this.maxPerRequest
    const tasks = []
    while (count.gten(max)) {
      tasks.push({ first: first.clone(), count: max })
      first.iaddn(max)
      count.isubn(max)
    }
    if (count.gtn(0)) {
      tasks.push({ first: first.clone(), count: count.toNumber() })
    }
    this.add(tasks)
  }

  /**
   * Fetches blocks for the given task
   * @param  {Object} job
   * @param  {Peer} peer
   * @return {Promise} method must return
   */
  async fetch (job) {
    const { task, results, peer } = job
    const first = results ? task.first.addn(results.length) : task.first
    let count = results ? task.count - results.length : task.count
    if (count > this.maxPerRequest) {
      count = this.maxPerRequest
    }
    const headers = await peer.eth.getBlockHeaders({ block: first, max: count })
    const bodies = await peer.eth.getBlockBodies(headers.map(h => h.hash()))
    const blocks = bodies.map((body, i) => new Block([headers[i]].concat(body)))
    return { blocks }
  }

  /**
   * Process fetch reply
   * @param  {Object} job fetch job
   * @param  {Peer}   peer peer that handled task
   * @param  {Object} reply reply data
   * @emits  headers
   */
  process (job, reply) {
    if (!this.running) {
      return
    }

    const { blocks } = reply
    if (!blocks || blocks.length === 0) {
      this.enqueue(job)
    } else {
      const { task, results } = job
      job.results = results ? results.concat(blocks) : blocks
      if (job.results.length < task.count) {
        this.enqueue(job)
      } else {
        job.finished = true
      }
    }
  }

  fetchable (peer) {
    return peer.eth
  }
}

module.exports = BlockFetcher
