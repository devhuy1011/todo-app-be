import express from 'express'
import * as path from 'path'
import logger from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import LOGGER from './server/utils/logger'

import todoRouter from './server/api/todo'

// set up dependencies
const app = express();
require('dotenv').config();
const session = require('express-session');


// Middleware
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'artnguidesecrethmm$#@!',
  cookie: { maxAge: 60000 }
}));
app.use(cors({
  exposedHeaders: ['Content-Disposition']
}))
app.use(logger('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'server/public')))
app.use(helmet())

// HOST + PORT
const host = process.env.HOST
const port = process.env.PORT
const socketPort = process.env.SOCKET_PORT
// logger

app.use((req, res, next) => {
  // console.log(req)
  LOGGER.HTTP.request(req)
  next()
})

// Route
const { PREFIX } = process.env
app.use(`${PREFIX}/todo`, todoRouter)

// Handle unknown route
app.use((req, res) => {
  res.status(404).send({
    result: false,
    message: `${req.url} not found!`
  })
})

app.listen(port, () => {
  console.log(`Server is listening on ${host}:${port}`)
})


//socket
import SocketUtils from './server/socket/socketHandle';
console.log("SocketUtils in app", SocketUtils)
SocketUtils.init(app, host, socketPort)