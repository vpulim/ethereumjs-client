'use strict'

const { Readable } = require('stream')
const Heap = require('qheap')
const { defaultLogger } = require('../../logging')

const defaultOptions = {
  logger: defaultLogger,
  timeout: 5000,
  interval: 1000,
  banTime: 60000
}

/**
 * Base class for fetchers that retrieve various data from peers. Subclasses must
 * override the before(), fetch() and process() methods. Tasks can be arbitrary
 * objects whose structure is defined by subclasses. A priority queue is used to
 * ensure most important tasks are processed first based on the before() function.
 * Fetchers are readable streams.
 * @memberof module:sync/fetcher
 */
class Fetcher extends Readable {
  /**
   * Create new fetcher
   * @param {Object}   options constructor parameters
   * @param {PeerPool} options.pool peer pool
   * @param {number}   [options.timeout] fetch task timeout
   * @param {number}   [options.banTime] how long to ban misbehaving peers
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
    this.active = new Map()
    this.queue = new Heap({ comparBefore: (a, b) => a.index < b.index })
    this.finished = new Heap({ comparBefore: (a, b) => a.index < b.index })
    this.counter = {in: 0, out: 0}
    this.running = false
    this.paused = false
  }

  /**
   * Add new tasks to fetcher
   * @param {Object[]} tasks
   */
  add (tasks) {
    tasks.forEach(task => {
      const job = {
        task,
        index: this.counter.in++,
        results: null,
        finished: false,
        time: null,
        peer: null
      }
      this.queue.insert(job)
    })
  }

  /**
   * Enqueue job
   * @param {Object} job
   */
  enqueue (job) {
    if (this.running) {
      this.queue.insert(job)
    }
  }

  /**
   * Dequeue all finished tasks that completed in order
   */
  dequeue () {
    if (this.paused) return
    const { finished, counter } = this
    for (let f = finished.peek(); f && f.index === counter.out; counter.out++) {
      const { results } = finished.remove()
      if (!this.push(results)) {
        this.paused = true
        return
      }
      f = finished.peek()
    }
  }

  /**
   * handle successful job completion
   * @private
   * @param  {Object} job successful job
   */
  success (job) {
    if (!job) return
    job.peer.idle = true
    this.active.delete(job.peer.id)
    if (job.finished) {
      this.finished.insert(job)
      this.dequeue()
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
    if (!job) return
    job.peer.idle = true
    this.active.delete(job.peer.id)
    this.enqueue(job)
    if (error) {
      this.error(error, job)
    }
    this.pool.ban(job.peer, this.banTime)
    this.next()
  }

  /**
   * Implements Readable._read() by pushing completed tasks to the read queue
   */
  _read () {
    this.paused = false
    this.dequeue()
  }

  /**
   * Implements Readable._destroy()
   */
  _destroy (err, cb) {
    this.error(err)
    this.stop().then(() => cb(), (err) => cb(err))
  }

  /**
   * Process next task
   */
  next () {
    const job = this.queue.peek()
    if (!job) {
      return false
    }
    const peer = this.pool.idle(this.fetchable.bind(this))
    if (peer) {
      peer.idle = false
      this.queue.remove()
      job.time = Date.now()
      job.peer = peer
      this.active.set(peer.id, job)
      this.fetch(job, peer)
        .then(reply => this.handle(reply, peer))
        .catch(error => this.failure(job, error))
      return job
    }
  }

  /**
   * Handler for responses from peers. Finds and processes the corresponding
   * task using the process() method, and resets peer to an idle state.
   * @param  {Object} reply
   * @param  {Peer}   peer
   */
  handle (reply, peer) {
    const job = this.active.get(peer.id)
    if (job) {
      if (reply) {
        try {
          this.process(job, reply)
          this.success(job)
        } catch (error) {
          this.failure(job, error)
        }
      } else {
        // if fetch returns a falsy reply, then re-add task
        this.failure(job)
      }
    } else {
      peer.idle = true
      this.logger.warn(`Task missing for peer ${peer}`)
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
   * Expires all tasks that have timed out. Peers that take too long to respond
   * will be banned for 5 minutes. Timeout out tasks will be re-inserted into the
   * queue.
   */
  expire () {
    const now = Date.now()
    for (let [peerId, job] of this.active) {
      if (now - job.time > this.timeout) {
        if (this.pool.contains(job.peer)) {
          this.logger.debug(`Task timed out for peer (banning) ${JSON.stringify(job.task)} ${job.peer}`)
          this.pool.ban(job.peer, this.banTime)
        } else {
          this.logger.debug(`Peer disconnected while performing task ${JSON.stringify(job.task)} ${job.peer}`)
        }
        this.active.delete(peerId)
        this.enqueue(job)
      }
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
    this.running = true
    while (this.running) {
      this.expire()
      if (this.paused) {
        await this.wait()
      } else if (!this.next()) {
        if (this.queue.length === 0 && this.active.size === 0) {
          this.running = false
          this.push(null)
        }
        await this.wait()
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
    while (this.queue.remove()) {}
    this.running = false
    while (this.active.size) {
      await this.wait()
    }
    this.counter = {in: 0, out: 0}
  }

  /**
   * True if peer can process fetch tasks
   * @param  {Peer}    peer candidate peer
   * @return {boolean}
   */
  fetchable (peer) {
    return true
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
  process (job, peer, reply) {
    throw new Error('Unimplemented')
  }

  async wait (delay) {
    await new Promise(resolve => setTimeout(resolve, delay || this.interval))
  }
}

module.exports = Fetcher
