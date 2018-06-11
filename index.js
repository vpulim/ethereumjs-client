'use strict'

const chains = require('ethereumjs-common/chains')
const nodeTypes = require('./lib/node')
const logging = require('./lib/log/logging')

const networks = Object.entries(chains.names)

const args = require('yargs')
  .option('networkid', {
    describe: `Network: ${networks.map(n => n.join('=')).join(', ')}`,
    default: 1
  })
  .option('syncmode', {
    describe: 'Blockchain sync mode: light',
    default: 'light'
  })
  .option('loglevel', {
    describe: 'Logging verbosity: error, warn, info, debug',
    default: 'info'
  })
  .locale('en_EN')
  .argv

const logger = logging.getLogger(args.loglevel)

async function run () {
  let node

  if (args.syncmode === 'light') {
    node = new nodeTypes.LightNode({
      logger: logger
    })
  } else {
    throw new Error(`Unknown syncmode: ${syncmode}`)
  }

  await node.open()
  await node.sync()
}

run().catch(err => logger.error(err))
