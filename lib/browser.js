const ethereumjs = {}

// Blockchain
ethereumjs.Chain = require('./blockchain/chain')
ethereumjs.BlockPool = require('./blockchain/blockpool')
ethereumjs.HeaderPool = require('./blockchain/headerpool')

// Handler
ethereumjs.Handler = require('./handler/handler')
ethereumjs.EthHandler = require('./handler/ethhandler')
ethereumjs.LesHandler = require('./handler/leshandler')

// Peer
ethereumjs.Peer = require('./net/peer/peer')
ethereumjs.Libp2pPeer = require('./net/peer/libp2ppeer')

// Peer Pool
ethereumjs.PeerPool = require('./net/peerpool')

// Protocol
ethereumjs.Protocol = require('./net/protocol/protocol')
ethereumjs.EthProtocol = require('./net/protocol/ethprotocol')
ethereumjs.LesProtocol = require('./net/protocol/lesprotocol')
ethereumjs.FlowControl = require('./net/protocol/flowcontrol')

// Server
ethereumjs.Server = require('./net/server/server')
ethereumjs.Libp2pServer = require('./net/server/libp2pserver')

// Node
ethereumjs.Node = require('./node')

// Service
ethereumjs.Service = require('./service/service')
ethereumjs.EthereumService = require('./service/ethereumservice')

// Synchronizer
ethereumjs.Synchronizer = require('./sync/sync')
ethereumjs.FastSynchronizer = require('./sync/fastsync')
ethereumjs.LightSynchronizer = require('./sync/lightsync')

// Utilities
ethereumjs.util = require('./util')

// Logging
ethereumjs.logging = require('./logging')

window.ethereumjs = ethereumjs
