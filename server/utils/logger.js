import { loggers, transports, format } from 'winston'
import 'winston-daily-rotate-file';
import path from 'path'
import { levels } from 'logform'
require('dotenv').config()

const logPath = process.env.LOG_PATH

const appFormatter = format
  .combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => {
      return `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
    }))

const httpFormatter = format.combine(
  format.printf(
    (info) => {
      // console.log(info);
      return `[${info.label || ''}]\t${info.timestamp}\t[${info.level || ''}]\t[${info.type || ''}]\t[${info.ip || ''}]\t[${info.method || ''}]\t${info.path || ''}\t[${info.identify || ''}] \t---- ${JSON.stringify(info.message)} ;`;
    }
  )
)

const sqlFormatter = format.combine(
  format.printf(
    (info) => {
      return `[${info.label || ''}]\t${info.timestamp}\t[${info.level || ''}]\t[${info.type || 'SQL'}]\t${info.message ? JSON.stringify(info.message) : ''}`;
    }
  )
)

const kakaoMsgFormatter = format
  .combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => {
      return `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message} .`
    }))

const adminLogFormatter = format
  .combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => {
      // console.log("info:",info);
      return `[${info.timestamp}] [${info.level.toUpperCase()}] [${info?.message?.user?.userName}] [${info.message?.ip}] ${info.message?.path}\n-Body:${JSON.stringify(info?.message?.body)}\n-Resp:${JSON.stringify(info.message?.resp)} .`
    }))

const adminLogExportFormatter = format
  .combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => {
      // console.log("info:",info);
      return `[${info.timestamp}] [${info?.message?.user?.userName}] [${info.message?.ip}] ${info.message?.path}\n-Body request:${JSON.stringify(info?.message?.body)}\n-file:${JSON.stringify(info.message?.fileName)} .`
    }))

const consoleLogOptions = {
  level: 'debug',
  handleExceptions: true,
  json: false,
  colorize: true
}

loggers.add('app', {
  format: format.combine(
    format.label({ label: 'Artnguide' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    appFormatter
  ),
  transports: [
    new transports.Console(consoleLogOptions), // comment here if no need debug console,
    new transports.File({
      level: 'error',
      filename: path.resolve(logPath, 'error.log'),
      handleExceptions: true,
      maxsize: 10485760,
      maxFiles: 50
    }),
    new transports.File({
      level: 'info',
      filename: path.resolve(logPath, 'app.log'),
      handleExceptions: true,
      maxsize: 10485760,
      maxFiles: 50
    })

  ]
})

loggers.add('kakaoMsg', {
  format: format.combine(
    format.label({ label: 'KAKAOMSG' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    kakaoMsgFormatter
  ),
  transports: [
    new transports.File({
      level: 'info',
      filename: path.resolve(logPath, 'kakaomsg.log'),
      handleExceptions: true,
      maxsize: 10485760,
      maxFiles: 50
    })

  ]
})

loggers.add('adminLog', {
  format: format.combine(
    format.label({ label: 'ADMINLOG' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    adminLogFormatter
  ),
  transports: [
    new transports.DailyRotateFile({
      level: 'info',
      filename: path.resolve(logPath, 'admin-log-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      handleExceptions: true,
      maxSize: '20m',
    })

  ]
})

loggers.add('adminLogExport', {
  format: format.combine(
    format.label({ label: 'ADMINLOGEXPORT' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    adminLogExportFormatter
  ),
  transports: [
    new transports.DailyRotateFile({
      level: 'info',
      filename: path.resolve(logPath, 'log-export-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      handleExceptions: true,
      maxSize: '20m',
    })

  ]
})

loggers.add('http', {
  format: format.combine(
    format.label({ label: 'HTTP' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    httpFormatter
  ),
  transports: [
    new transports.Console(consoleLogOptions), // comment here if no need debug console
    new transports.File({
      level: 'info',
      filename: path.resolve(logPath, 'http.log'),
      handleExceptions: false,
      maxsize: 10485760,
      maxFiles: 50
    })

  ]
})

loggers.add('db', {
  format: format.combine(
    format.label({ label: 'DATABASE' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sqlFormatter
  ),
  transports: [
    // new transports.Console(consoleLogOptions), // comment here if no need debug console
    new transports.File({
      level: 'error',
      filename: path.resolve(logPath, 'sql_error.log'),
      handleExceptions: false,
      maxsize: 10485760,
      maxFiles: 50
    }),
    new transports.File({
      level: 'info',
      filename: path.resolve(logPath, 'sql_query.log'),
      handleExceptions: false,
      maxsize: 10485760,
      maxFiles: 50
    })

  ]
})

const APP = loggers.get('app')

const HTTP = loggers.get('http')
HTTP.request = async (request) => {
  const data = {
    body: { ...request.body },
    query: { ...request.query },
    params: { ...request.params }
  }
  // console.log(data);
  HTTP.info(data, {
    type: 'REQUEST', ip: request.ip, url: request.url, method: request.method, identify: request.user, path: request.path
  })
}

const DB = loggers.get('db')
DB.query = async (data) => {
  DB.info(data, { type: 'SQL' })
}
DB.queryResponse = async (data) => {
  DB.info(data, { type: "RESPONSE SQL" })
}

const KAKAOMSG = loggers.get('kakaoMsg');

const ADMINLOG = loggers.get('adminLog');

const EXPORTLOG = loggers.get('adminLogExport');


APP.exitOnError = false
HTTP.exitOnError = false
DB.exitOnError = false
KAKAOMSG.exitOnError = false;
ADMINLOG.exitOnError = false;
EXPORTLOG.exitOnError = false;

const LOGGER = {
  APP, HTTP, DB, KAKAOMSG, ADMINLOG, EXPORTLOG
}

export default LOGGER
