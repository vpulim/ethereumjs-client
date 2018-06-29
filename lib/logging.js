'use strict'

const chalk = require('chalk')
const winston = require('winston')
const { createLogger, format, transports } = winston
const { combine, timestamp, label, printf } = format

const levelColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'white'
}

const errorFormat = format(info => {
  if (info.message instanceof Error && info.message.stack) {
    info.message = info.message.stack
  }
  if (info instanceof Error && info.stack) {
    return Object.assign({ message: info.stack }, info)
  }
  return info
})

function logFormat () {
  return printf(info => {
    const level = chalk[levelColors[info.level]](info.level.toUpperCase())
    return `${level} [${info.timestamp}] ${info.message}`
  })
}

function getLogger (logLevel) {
  const logger = createLogger({
    format: combine(
      errorFormat(),
      format.splat(),
      label({ label: 'ethereumjs' }),
      timestamp({ format: 'MM-DD|HH:mm:ss'}),
      logFormat()
    ),
    level: logLevel,
    transports: [
      new transports.Console()
    ],
    exceptionHandlers: [
      new transports.Console()
    ]
  })
  return logger
}

winston.add(new winston.transports.Console())

exports.defaultLogger = winston
exports.getLogger = getLogger
