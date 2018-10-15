'use strict'

/**
 * Libp2p Bundle
 * @memberof module:net/peer
 */

 const TCP = require('libp2p-tcp')
 const Bootstrap = require('libp2p-bootstrap')
 const KadDHT = require('libp2p-kad-dht')
 const Multiplex = require('libp2p-mplex')
 const SECIO = require('libp2p-secio')
 const libp2p = require('libp2p')
 const defaultsDeep = require('@nodeutils/defaults-deep')

 class Libp2pNode extends libp2p {
   constructor (options) {
     super({
       peerInfo: options.peerInfo,
       modules: {
         transport: [
           TCP,
         ],
         streamMuxer: [
           Multiplex
         ],
         connEncryption: [
           SECIO
         ],
         peerDiscovery: [
           Bootstrap
         ],
         dht: KadDHT
       },
       config: {
         peerDiscovery: {
           bootstrap: {
             interval: 2000,
             enabled: options.bootstrap === undefined ? true : options.bootstrap,
             list: options.bootnodes || []
           }
         },
         dht: {
           kBucketSize: 20
         },
         EXPERIMENTAL: {
           dht: false,
           pubsub: false
         }
       }
     })
   }
 }

 module.exports = Libp2pNode
