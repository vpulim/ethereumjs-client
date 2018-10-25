#!/usr/bin/env node
'use strict'

const Common = require('ethereumjs-common')
const chains = require('ethereumjs-common/chains')
const { getLogger } = require('../lib/logging')
const { parse } = require('../lib/util')
const { fromName: serverFromName } = require('./net/server')
const Node = require('../lib/node')
const jayson = require('jayson')
const RPCManager = require('../lib/rpc')
const level = require('level')
const os = require('os')
const path = require('path')
const fs = require('fs-extra')

const networks = Object.entries(chains.names)
const args = require('yargs')
  .options({
    'network': {
      describe: `Network`,
      choices: networks.map(n => n[1]),
      default: networks[0][1]
    },
    'syncmode': {
      describe: 'Blockchain sync mode',
      choices: [ 'light', 'fast' ],
      default: 'light'
    },
    'lightserv': {
      describe: 'Serve light peer requests',
      boolean: true,
      default: false
    },
    'datadir': {
      describe: 'Data directory for the blockchain',
      default: `${os.homedir()}/Library/Ethereum`
    },
    'transports': {
      describe: 'Network transports',
      default: ['rlpx:port=30303'],
      array: true
    },
    'rpc': {
      describe: 'Enable the JSON-RPC server',
      boolean: true,
      default: false
    },
    'rpcport': {
      describe: 'HTTP-RPC server listening port',
      number: true,
      default: 8545
    },
    'rpcaddr': {
      describe: 'HTTP-RPC server listening interface',
      default: 'localhost'
    },
    'loglevel': {
      describe: 'Logging verbosity',
      choices: [ 'error', 'warn', 'info', 'debug' ],
      default: 'info'
    },
    'params': {
      describe: 'Path to chain parameters json file',
      coerce: path.resolve
    }
  })
  .locale('en_EN')
  .argv
const logger = getLogger({loglevel: args.loglevel})

async function runNode (options) {
  logger.info('Initializing Ethereumjs client...')
  if (options.lightserv) {
    logger.info(`Serving light peer requests`)
  }
  const node = new Node(options)
  node.on('error', err => logger.error(err))
  node.on('listening', details => {
    logger.info(`Listener up transport=${details.transport} url=${details.url}`)
  })
  node.on('synchronized', (stats) => {
    logger.info(`Synchronized ${stats.count} ${stats.type === 'light' ? 'headers' : 'blocks'}`)
  })
  logger.info(`Connecting to network: ${options.common.chainName()}`)
  logger.info(`Data directory: ${options.dataDir}`)
  await node.open()
  logger.info('Synchronizing blockchain...')
  node.start()

  return node
}

function runRpcServer (node, options) {
  const { rpcport, rpcaddr } = options
  const manager = new RPCManager(node, options)
  const server = jayson.server(manager.getMethods())
  logger.info(`RPC HTTP endpoint opened: http://${rpcaddr}:${rpcport}`)
  server.http().listen(rpcport)
}

async function run () {
  const syncDirName = args.syncmode === 'light' ? 'lightchaindata' : 'chaindata'
  const networkDirName = args.network === 'mainnet' ? '' : `${args.network}/`
  const chainParams = args.params ? await parse.params(args.params) : args.network
  const common = new Common(chainParams)
  const servers = parse.transports(args.transports).map(t => {
    const Server = serverFromName(t.name)
    if (t.name === 'rlpx') {
      t.options.bootnodes = t.options.bootnodes || common.bootstrapNodes()
    }
    return new Server(Object.assign({}, t.options))
  })
  const dataDir = `${args.datadir}/${networkDirName}ethereumjs/${syncDirName}`
  fs.ensureDirSync(dataDir)
  const options = {
    common,
    logger,
    servers,
    syncmode: args.syncmode,
    lightserv: args.lightserv,
    db: level(dataDir),
    rpcport: args.rpcport,
    rpcaddr: args.rpcaddr
  }
  const node = await runNode(options)

  if (args.rpc) {
    runRpcServer(node, options)
  }
}

run().catch(err => logger.error(err))
