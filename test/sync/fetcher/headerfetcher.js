const tape = require('tape-catch')
const td = require('testdouble')
// const BN = require('bn.js')
const EventEmitter = require('events')
const { defaultLogger } = require('../../../lib/logging')
defaultLogger.silent = true

tape('[HeaderFetcher]', t => {
  class PeerPool extends EventEmitter {}
  PeerPool.prototype.idle = td.func()
  PeerPool.prototype.ban = td.func()
  td.replace('../../../lib/net/peerpool', PeerPool)
  const HeaderFetcher = require('../../../lib/sync/fetcher/headerfetcher')

  t.test('should process', t => {
    const fetcher = new HeaderFetcher({pool: new PeerPool(), flow: td.object()})
    const headers = [{number: 1}, {number: 2}]
    t.deepEquals(fetcher.process({task: {count: 2}, peer: 'peer0'}, {headers, bv: 1}), headers, 'got results')
    t.notOk(fetcher.process({task: {count: 2}}, {headers: []}), 'bad results')
    td.verify(fetcher.flow.handleReply('peer0', 1))
    t.end()
  })

  t.test('should find a fetchable peer', async (t) => {
    const pool = new PeerPool()
    const fetcher = new HeaderFetcher({pool})
    td.when(fetcher.pool.idle(td.matchers.anything())).thenReturn('peer0')
    t.equals(fetcher.peer(), 'peer0', 'found peer')
    t.end()
  })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
