'use strict'

const Synchronizer = require('./sync')
const Fetcher = require('./fetcher')
const Block = require('ethereumjs-block')
const BN = require('ethereumjs-util').BN
const defaultLogger = require('../logging').defaultLogger
const { codes } = require('../net/protocol').EthProtocol

const defaultOptions = {
  logger: defaultLogger,
  minPeers: 2
}

const MAX_PER_REQUEST = 100

async function timeout (delay) {
  await new Promise(resolve => setTimeout(resolve, delay))
}

class FastSynchronizer extends Synchronizer {
  constructor (options) {
    super(options)
    options = {...defaultOptions, ...options}

    this.logger = options.logger
    this.pool = options.pool
    this.chain = options.chain
    this.minPeers = options.minPeers
    this.fetchers = new Map()
    this.init()
  }

  init () {
    this.opened = false
    this.syncing = false
    this.pool.on('message:eth', (message, peer) => this.handle(message, peer))
  }

  async handle (message, peer) {
    const fetcher = this.fetchers.get(message.code)
    if (fetcher) {
      fetcher.handle(message, peer)
    }
  }

  async open () {
    if (this.opened) {
      return
    }
    await this.pool.open()
    await this.chain.open()
    this.opened = true
    const number = this.chain.height.toString(10)
    const td = this.chain.td.toString(10)
    this.logger.info(`Latest local header: number=${number} td=${td}`)
  }

  async height (peer) {
    peer.eth.getBlockHeaders(peer.eth.head, 1, 0, 0)
    const headers = await peer.eth.response(codes.BLOCK_HEADERS)
    const header = new Block.Header(headers[0])
    return new BN(header.number)
  }

  async origin () {
    let best
    let height
    while (!height) {
      await timeout(1000)
      if (this.pool.peers.length < this.minPeers) {
        continue
      }
      for (let peer of this.pool.peers) {
        if (!best || best.eth.td < peer.eth.td) {
          best = peer
        }
      }
      try {
        height = await this.height(best)
      } catch (error) {
        this.pool.ban(best)
        this.logger.debug(`Error getting peer height: ${best} ${error}`)
      }
    }
    return [best, height]
  }

  async fetch (first, last) {
    const headerFetcher = new HeaderFetcher({
      pool: this.pool,
      logger: this.logger
    })
    this.fetchers.set(codes.BLOCK_HEADERS, headerFetcher)
    headerFetcher.on('headers', headers => {
      const count = headers.length
      const number = new BN(headers[0].number).toString(10)
      const hash = headers[0].hash().toString('hex').slice(0, 8) + '...'
      this.logger.info(`Imported new block headers count=${count} number=${number} hash=${hash}`)
    })
    headerFetcher.add({ first, last })
    await headerFetcher.run()
    this.fetchers.delete(codes.BLOCK_HEADERS)
  }

  async sync () {
    this.syncing = true
    const [ origin, height ] = await this.origin()
    this.logger.debug(`Using origin peer: ${origin} height=${height.toString(10)}`)
    await this.fetch(this.chain.height.addn(1), height)
    this.syncing = false
  }
}

class HeaderFetcher extends Fetcher {
  constructor (options) {
    super (options)
  }

  before (taskOne, taskTwo) {
    return taskOne.first.lt(taskTwo.first)
  }

  fetch (task, peer) {
    let count = task.last.sub(task.first).addn(1)
    if (count.gtn(MAX_PER_REQUEST)) {
      count = MAX_PER_REQUEST
    } else {
      count = count.toNumber()
    }
    peer.eth.getBlockHeaders(task.first.toBuffer(), count, 0, 0)
  }

  process (task, payload) {
    if (!payload || payload.length === 0) {
      this.add(task)
    } else {
      const headers = payload.map(h => new Block.Header(h))
      const first = new BN(headers[0].number)
      const last = new BN(headers[headers.length-1].number)
      if (last.lt(task.last)) {
        this.add({ first: last.addn(1), last: task.last})
      }
      this.emit('headers', headers)
    }
  }
}

module.exports = FastSynchronizer
