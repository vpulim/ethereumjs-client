'use strict'

const EventEmitter = require('events')
const Heap = require('qheap')

async function timeout (delay) {
  await new Promise(resolve => setTimeout(resolve, delay))
}

class Fetcher extends EventEmitter {
  constructor (options) {
    super()
    this.pool = options.pool
    this.logger = options.logger
    this.maxFetchTime = 5000
    this.active = new Map()
    this.heap = new Heap({
      comparBefore: (a, b) => this.before(a, b)
    })
    this.running = false
  }

  add (task) {
    this.heap.insert(task)
  }

  next () {
    const task = this.heap.peek()
    if (!task) {
      return
    }
    const peer = this.pool.idle()
    if (peer) {
      peer.idle = false
      this.heap.remove()
      this.active.set(peer.id, { time: Date.now(), task: task, peer: peer })
      this.fetch(task, peer)
      return task
    } else {
      this.logger.debug(`No idle peers found. Waiting...`)
    }
  }

  before (taskOne, taskTwo) {
    return true
  }

  handle (message, peer) {
    peer.idle = true
    const { time, task } = this.active.get(peer.id)
    if (task) {
      this.active.delete(peer.id)
      try {
        this.process(task, message.payload)
      } catch (error) {
        this.logger.error(`Error processing task ${JSON.stringify(task)} with peer ${peer}: ${error}`)
      }
      this.next()
    } else {
      this.logger.warn(`Task missing for peer ${JSON.stringify(task)} ${peer}`)
    }
  }

  expire () {
    const now = Date.now()
    for (let [id, entry ] of this.active) {
      if (now - entry.time > this.maxFetchTime) {
        this.logger.debug(`Task timed out for peer (banning) ${JSON.stringify(entry.task)} ${entry.peer}`)
        this.pool.ban(entry.peer, 300000)
        this.active.delete(id)
        this.add(entry.task)
      }
    }
  }

  fetch (task, peer) {
  }

  process (task, payload) {
  }

  async run () {
    if (this.running) {
      return
    }
    this.running = true
    while(this.running) {
      this.expire()
      if (!this.next()) {
        if (this.heap.length === 0 && this.active.size === 0) {
          this.running = false
        } else {
          await timeout(this.maxFetchTime)
        }
      }
    }
  }
}

module.exports = Fetcher
