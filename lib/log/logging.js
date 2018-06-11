'use strict'

const chalk = require('chalk')
const { createLogger, format, transports } = require('winston')
const { combine, timestamp, label, printf } = format

const levelColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'white'
}

function logFormat () {
  return printf(info => {
    const level = chalk[levelColors[info.level]](info.level.toUpperCase())
    return `${level} [${info.timestamp}] ${info.message}`
  })
}

function getLogger (logLevel) {
  const logger = createLogger({
    format: combine(
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

exports.getLogger = getLogger
