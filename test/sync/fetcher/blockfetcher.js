const tape = require('tape-catch')
const td = require('testdouble')
const BN = require('bn.js')
const Block = require('ethereumjs-block')
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
  const ONE = new BN(1)
  const TWO = new BN(2)

  t.test('should start/stop', async (t) => {
    const fetcher = new BlockFetcher({
      pool: new PeerPool(),
      first: new BN(1),
      count: 10,
      timeout: 5
    })
    t.notOk(fetcher.running, 'not started')
    fetcher.start()
    await wait()
    t.ok(fetcher.running, 'started')
    fetcher.stop()
    await wait()
    t.notOk(fetcher.running, 'stopped')
    t.end()
  })

  t.test('should fetch', async (t) => {
    const pool = new PeerPool()
    const fetcher = new BlockFetcher({
      pool,
      first: new BN(1),
      count: 2
    })
    const peer = {eth: td.object()}
    const headers = [new Block.Header({number: 1}), new Block.Header({number: 12})]
    const bodies = [[[], []], [[], []]]
    const blocks = [new Block([headers[0]].concat(bodies[0])), new Block([headers[1]].concat(bodies[1]))]
    td.when(pool.idle(td.matchers.anything())).thenReturn(peer)
    td.when(peer.eth.getBlockHeaders({block: ONE, max: 2})).thenResolve(headers)
    td.when(peer.eth.getBlockBodies(td.matchers.anything())).thenResolve(bodies)
    fetcher.start()
    fetcher.on('data', (data) => {
      t.deepEquals(
        data.map(r => [].concat(...r.raw)),
        blocks.map(b => [].concat(...b.raw)),
        'got blocks'
      )
      t.end()
    })
  })

  // t.test('should process', t => {
  //   const fetcher = new BlockFetcher({pool: new PeerPool()})
  //   const blocks = [{header: {number: 1}}, {header: {number: 2}}]
  //   fetcher.running = true
  //   fetcher.add = td.func()
  //   fetcher.process({task: 'task'}, {blocks: []})
  //   td.verify(fetcher.add('task'))
  //   fetcher.process({task: {last: TWO}}, {blocks})
  //   setTimeout(() => {
  //     td.verify(fetcher.add({first: ONE, last: TWO}))
  //     t.pass('processed tasks')
  //     t.end()
  //   }, 10)
  // })
  //
  // t.test('should check if peer fetchable', async (t) => {
  //   const fetcher = new BlockFetcher({pool: new PeerPool()})
  //   t.ok(fetcher.fetchable({eth: {}}), 'fetchable')
  //   t.end()
  // })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
