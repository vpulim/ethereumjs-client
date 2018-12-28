const tape = require('tape-catch')
const td = require('testdouble')
const BN = require('bn.js')
const EventEmitter = require('events')
const { defaultLogger } = require('../../../lib/logging')
defaultLogger.silent = true

async function wait (delay) {
  await new Promise(resolve => setTimeout(resolve, delay || 10))
}

tape('[BlockFetcher]', t => {
  class PeerPool extends EventEmitter {}
  PeerPool.prototype.idle = td.func()
  PeerPool.prototype.ban = td.func()
  td.replace('../../../lib/net/peerpool', PeerPool)
  const BlockFetcher = require('../../../lib/sync/fetcher/blockfetcher')

  t.test('should start/stop', async (t) => {
    const fetcher = new BlockFetcher({
      pool: new PeerPool(),
      first: new BN(1),
      count: 10,
      maxPerRequest: 5,
      timeout: 5
    })
    fetcher.next = () => false
    t.notOk(fetcher.running, 'not started')
    fetcher.fetch()
    t.equals(fetcher.in.size(), 2, 'added 2 tasks')
    await wait()
    t.ok(fetcher.running, 'started')
    fetcher.destroy()
    await wait()
    t.notOk(fetcher.running, 'stopped')
    t.end()
  })

  t.test('should process', t => {
    const fetcher = new BlockFetcher({pool: new PeerPool()})
    const blocks = [{header: {number: 1}}, {header: {number: 2}}]
    t.deepEquals(fetcher.process({task: {count: 2}}, {blocks}), blocks, 'got results')
    t.notOk(fetcher.process({task: {count: 2}}, {blocks: []}), 'bad results')
    t.end()
  })

  t.test('should find a fetchable peer', async (t) => {
    const pool = new PeerPool()
    const fetcher = new BlockFetcher({pool})
    td.when(fetcher.pool.idle(td.matchers.anything())).thenReturn('peer0')
    t.equals(fetcher.peer(), 'peer0', 'found peer')
    t.end()
  })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
