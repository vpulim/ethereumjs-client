const tape = require('tape-catch')
const td = require('testdouble')
const BN = require('bn.js')
const EventEmitter = require('events')
const { defaultLogger } = require('../../lib/logging')
defaultLogger.silent = true

tape('[LightSynchronizer]', t => {
  class PeerPool extends EventEmitter {}
  td.replace('../../lib/net/peerpool', PeerPool)
  class HeaderFetcher extends EventEmitter {}
  HeaderFetcher.prototype.fetch = td.func()
  td.replace('../../lib/sync/fetcher', { HeaderFetcher })
  const LightSynchronizer = require('../../lib/sync/lightsync')

  t.test('should initialize correctly', async (t) => {
    const pool = new PeerPool()
    const sync = new LightSynchronizer({pool})
    pool.emit('added', {les: {status: {serveHeaders: true}}})
    t.equals(sync.type, 'light', 'light type')
    t.end()
  })

  t.test('should find best', async (t) => {
    const sync = new LightSynchronizer({interval: 1, pool: new PeerPool()})
    sync.running = true
    sync.chain = {headers: {td: new BN(1)}}
    const peers = [
      {les: {status: {headTd: new BN(1), headNum: new BN(1), serveHeaders: 1}}, inbound: false},
      {les: {status: {headTd: new BN(2), headNum: new BN(2), serveHeaders: 1}}, inbound: false}
    ]
    sync.pool = {peers}
    sync.forceSync = true
    t.equals(sync.best(), peers[1], 'found best')
    t.end()
  })

  t.test('should sync', async (t) => {
    t.plan(3)
    const sync = new LightSynchronizer({interval: 1, pool: new PeerPool()})
    sync.best = td.func()
    sync.latest = td.func()
    td.when(sync.best()).thenReturn({les: {status: {headNum: new BN(2)}}})
    td.when(HeaderFetcher.prototype.fetch(), {delay: 20}).thenResolve()
    sync.chain = {headers: {height: new BN(3)}}
    t.notOk(await sync.sync(), 'local height > remote height')
    sync.chain = {headers: {height: new BN(0)}}
    t.ok(await sync.sync(), 'local height < remote height')
    td.when(HeaderFetcher.prototype.fetch()).thenReject('err0')
    try {
      await sync.sync()
    } catch (err) {
      t.equals(err, 'err0', 'got error')
    }
  })

  t.test('should sync', async (t) => {
    t.plan(3)
    const sync = new LightSynchronizer({interval: 1, pool: new PeerPool()})
    sync.best = td.func()
    sync.latest = td.func()
    td.when(sync.best()).thenReturn({les: {status: {headNum: new BN(2)}}})
    td.when(HeaderFetcher.prototype.fetch(), {delay: 20}).thenResolve()
    sync.chain = {headers: {height: new BN(3)}}
    t.notOk(await sync.sync(), 'local height > remote height')
    sync.chain = {headers: {height: new BN(0)}}
    t.ok(await sync.sync(), 'local height < remote height')
    td.when(HeaderFetcher.prototype.fetch()).thenReject('err0')
    try {
      await sync.sync()
    } catch (err) {
      t.equals(err, 'err0', 'got error')
    }
  })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
