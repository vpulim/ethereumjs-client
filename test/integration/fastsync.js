'use strict'

const tape = require('tape')
const { FastEthereumService } = require('../../lib/service')
const MockServer = require('./mocks/mockserver.js')
const MockChain = require('./mocks/mockchain.js')
const { defaultLogger } = require('../../lib/logging')
// defaultLogger.silent = true

async function wait (delay) {
  await new Promise(resolve => setTimeout(resolve, delay))
}

tape('[Integration:FastSync]', async (t) => {
  async function setup (options = {}) {
    const server = new MockServer({location: options.location})
    const chain = new MockChain({height: options.height})
    const service = new FastEthereumService({
      servers: [ server ],
      interval: options.interval || 10,
      chain
    }).on('error', console.log)
    await service.open()
    await server.start()
    await service.start()
    return [server, service]
  }

  async function destroy (server, service) {
    await service.stop()
    await server.stop()
    await service.close()
  }

  t.test('should sync blocks', async (t) => {
    const [remoteServer, remoteService] = await setup({location: '127.0.0.2', height: 1000})
    const [localServer, localService] = await setup({location: '127.0.0.1', height: 0})
    localService.on('synchronized', async () => {
      t.pass('synced')
      await destroy(localServer, localService)
      await destroy(remoteServer, remoteService)
      t.end()
    })
    localServer.discover('remotePeer', '127.0.0.2')
  })

  // t.test('should not sync with stale peers', async (t) => {
  //   const [remoteServer, remoteService] = await setup({location: '127.0.0.2', height: 9})
  //   const [localServer, localService] = await setup({location: '127.0.0.1', height: 10})
  //   localService.on('synchronized', async () => {
  //     t.fail('synced with a stale peer')
  //   })
  //   localServer.discover('remotePeer', '127.0.0.2')
  //   await wait(100)
  //   await destroy(localServer, localService)
  //   await destroy(remoteServer, remoteService)
  //   t.pass('did not sync')
  //   t.end()
  // })
  // 
  // t.test('should find best origin peer', async (t) => {
  //   const [remoteServer1, remoteService1] = await setup({location: '127.0.0.2', height: 9})
  //   const [remoteServer2, remoteService2] = await setup({location: '127.0.0.3', height: 10})
  //   const [localServer, localService] = await setup({location: '127.0.0.1', height: 0})
  //   await localService.synchronizer.stop()
  //   await localServer.discover('remotePeer1', '127.0.0.2')
  //   await localServer.discover('remotePeer2', '127.0.0.3')
  //   localService.on('synchronized', async () => {
  //     t.pass('synced with best peer')
  //     await destroy(localServer, localService)
  //     await destroy(remoteServer1, remoteService1)
  //     await destroy(remoteServer2, remoteService2)
  //     t.end()
  //   })
  //   localService.synchronizer.start()
  // })
})
