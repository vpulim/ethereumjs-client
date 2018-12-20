'use strict'

const EventEmitter = require('events')
const Heap = require('qheap')
const { defaultLogger } = require('../../logging')

const defaultOptions = {
  logger: defaultLogger,
  timeout: 5000,
  interval: 1000,
  banTime: 60000,
  maxQueue: 16,
  maxPerRequest: 128
}

/**
 * Base class for fetchers that retrieve various data from peers. Subclasses must
 * override the before(), fetch() and process() methods. Tasks can be arbitrary
 * objects whose structure is defined by subclasses. A priority queue is used to
 * ensure most important tasks are processed first based on the before() function.
 * Fetchers are readable streams.
 * @memberof module:sync/fetcher
 */
class Fetcher extends EventEmitter {
  /**
   * Create new fetcher
   * @param {Object}   options constructor parameters
   * @param {PeerPool} options.pool peer pool
   * @param {number}   [options.timeout] fetch task timeout
   * @param {number}   [options.banTime] how long to ban misbehaving peers
   * @param {number}   [options.maxQueue] max write queue size
   * @param {number}   [options.maxPerRequest=128] max items per request
   * @param {number}   [options.interval] retry interval
   * @param {Logger}   [options.logger] Logger instance
   */
  constructor (options) {
    super({...options, objectMode: true})
    options = {...defaultOptions, ...options}

    this.pool = options.pool
    this.logger = options.logger
    this.timeout = options.timeout
    this.interval = options.interval
    this.banTime = options.banTime
    this.maxQueue = options.maxQueue
    this.maxPerRequest = options.maxPerRequest
    this.reset()
  }

  /**
   * Reset state
   */
  reset () {
    this.total = 0
    this.processed = 0
    if (this.in) while (this.in.remove()) {}
    if (this.out) while (this.out.remove()) {}
    this.in = new Heap({ comparBefore: (a, b) => a.index < b.index })
    this.out = new Heap({ comparBefore: (a, b) => a.index < b.index })
    this.running = false
    this.reading = false
  }

  /**
   * Generate list of tasks to fetch
   * @return {Object[]} tasks
   */
  tasks () {
    return []
  }

  /**
   * Enqueue job
   * @param {Object} job
   */
  enqueue (job) {
    if (this.running) {
      this.in.insert({
        ...job,
        time: Date.now(),
        state: 'idle',
        result: null
      })
    }
  }

  /**
   * Dequeue all done tasks that completed in order
   */
  dequeue () { 
    const { out, counter } = this
    for (let f = out.peek(); f && f.index === counter.out;) {
      counter.out++
      const { result } = out.remove()
      if (!this.push(result)) {
        return
      }
      f = out.peek()
    }
  }

  async read (processor) {
    this.reading = true
    let job
    while ((job = this.out.peek()) && this.processed === job.index) {
      try {
        this.out.remove()
        if (await processor(job.result)) {
          this.processed++
        } else {
          this.enqueue(job)
        }
      } catch (err) {
        this.logger.error('Fetcher processor error', err)
        this.enqueue(job)
      }
    }
    await processor()
    this.reading = false
  }

  /**
   * handle successful job completion
   * @private
   * @param  {Object} job successful job
   * @param  {Object} result job result
   */
  success (job, result) {
    if (job.state !== 'active') return
    job.peer.idle = true
    job.result = this.process(job, result)
    if (job.result) {
      this.out.insert(job)
      if (this.processed === job.index) this.emit('readable')
    }
    this.next()
  }

  /**
   * handle failed job completion
   * @private
   * @param  {Object} job failed job
   * @param  {Error}  [error] error
   */
  failure (job, error) {
    if (job.state !== 'active') return
    job.peer.idle = true
    this.pool.ban(job.peer, this.banTime)
    this.enqueue(job)
    if (error) {
      this.error(error, job)
    }
    this.next()
  }

  /**
   * Process next task
   */
  next () {
    console.log(`read: ${JSON.stringify(this.processed)} out: ${(this.out.peek() || {}).index} (${this.out.size()})`)
    const job = this.in.peek()
    if (
      !job ||
      job.index > this.processed + this.maxQueue
    ) {
      // if (this._readableState.length > this.maxQueue) this.read(0)
      return false
    }
    const peer = this.peer()
    if (peer) {
      peer.idle = false
      this.in.remove()
      job.peer = peer
      job.state = 'active'
      const timeout = setTimeout(() => {
        this.expire(job)
      }, this.timeout)
      this.fetch(job, peer)
        .then(result => this.success(job, result))
        .catch(error => this.failure(job, error))
        .finally(() => clearTimeout(timeout))
      return job
    }
  }

  /**
   * Handle error
   * @param  {Error}  error error object
   * @param  {Object} task  task
   * @param  {Peer}   peer  peer
   */
  error (error, job) {
    if (this.running) {
      this.emit('error', error, job && job.task, job && job.peer)
    }
  }

  /**
   * Run the fetcher. Returns a promise that resolves once all tasks are completed.
   * @return {Promise}
   */
  async start () {
    if (this.running) {
      return false
    }
    this.tasks().forEach(task => {
      const job = {
        task,
        time: Date.now(),
        index: this.total++,
        result: null,
        state: 'idle',
        peer: null
      }
      this.in.insert(job)
    })
    this.running = true
    while (this.running) {
      if (!this.next()) {
        if (this.processed === this.total) {
          this.reset()
        } else {
          await this.wait()
        }
      }
    }
  }

  /**
   * Stop the fetcher. Returns a promise that resolves once it is stopped.
   * @return {Promise}
   */
  async stop () {
    if (!this.running) {
      return false
    }
    this.reset()
    await this.wait(this.timeout)
  }

  /**
   * Returns a peer that can process the given job
   * @param  {Object} job job
   * @return {Peer}
   */
  peer (job) {
    return this.pool.idle()
  }

  /**
   * Sends a protocol command to peer for the specified job. Must return a
   * promise that resolves with the decoded response to the commad.
   * @param  {Object} job
   * @return {Promise}
   */
  fetch (job) {
    throw new Error('Unimplemented')
  }

  /**
   * Process the reply for the given job
   * @param  {Object} job fetch job
   * @param  {Peer}   peer peer that handled task
   * @param  {Object} reply reply data
   */
  process (job, result) {
    throw new Error('Unimplemented')
  }

  /**
   * Expire job that has timed out and ban associated peer. Timed out tasks will
   * be re-inserted into the queue.
   */
  expire (job) {
    job.state = 'expired'
    if (this.pool.contains(job.peer)) {
      this.logger.debug(`Task timed out for peer (banning) ${JSON.stringify(job.task)} ${job.peer}`)
      this.pool.ban(job.peer, 300000)
    } else {
      this.logger.debug(`Peer disconnected while performing task ${JSON.stringify(job.task)} ${job.peer}`)
    }
    this.enqueue(job)
  }

  async wait (delay) {
    await new Promise(resolve => setTimeout(resolve, delay || this.interval))
  }
}

module.exports = Fetcher
