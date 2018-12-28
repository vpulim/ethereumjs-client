const tape = require('tape-catch')
const td = require('testdouble')
const EventEmitter = require('events')
const { defaultLogger } = require('../../lib/logging')
defaultLogger.silent = true

tape('[LightEthereumService]', t => {
  class PeerPool extends EventEmitter { }
  PeerPool.prototype.open = td.func()
  td.replace('../../lib/net/peerpool', PeerPool)
  td.replace('../../lib/net/protocol/flowcontrol')
  const Chain = td.constructor()
  Chain.prototype.open = td.func()
  td.replace('../../lib/blockchain', { Chain })

  const LesProtocol = td.constructor()
  td.replace('../../lib/net/protocol/lesprotocol', LesProtocol)

  class LightSynchronizer extends EventEmitter { }
  LightSynchronizer.prototype.start = td.func()
  LightSynchronizer.prototype.stop = td.func()
  LightSynchronizer.prototype.open = td.func()
  td.replace('../../lib/sync/lightsync', LightSynchronizer)
  const LightEthereumService = require('../../lib/service/lightethereumservice')

  t.test('should initialize correctly', async (t) => {
    let service = new LightEthereumService()
    t.ok(service.synchronizer instanceof LightSynchronizer, 'light sync')
    t.equals(service.name, 'eth', 'got name')
    t.end()
  })

  t.test('should get protocols', async (t) => {
    let service = new LightEthereumService()
    t.ok(service.protocols[0] instanceof LesProtocol, 'light protocols')
    t.end()
  })

  t.test('should open', async (t) => {
    t.plan(3)
    const server = td.object()
    let service = new LightEthereumService({ servers: [server] })
    await service.open()
    td.verify(service.chain.open())
    td.verify(service.synchronizer.open())
    td.verify(server.addProtocols(td.matchers.anything()))
    service.on('synchronized', () => t.pass('synchronized'))
    service.once('error', err => t.equals(err, 'error0', 'got error 1'))
    service.synchronizer.emit('synchronized')
    service.synchronizer.emit('error', 'error0')
    service.once('error', err => t.equals(err, 'error1', 'got error 2'))
    service.pool.emit('banned', 'peer0')
    service.pool.emit('added', 'peer0')
    service.pool.emit('removed', 'peer0')
    service.pool.emit('error', 'error1')
  })

  t.test('should start/stop', async (t) => {
    const server = td.object()
    let service = new LightEthereumService({ servers: [server] })
    await service.start()
    td.verify(service.synchronizer.start())
    t.notOk(await service.start(), 'already started')
    await service.stop()
    td.verify(service.synchronizer.stop())
    td.verify(server.start())
    t.notOk(await service.stop(), 'already stopped')
    t.end()
  })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
