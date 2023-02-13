import CONFIG from './config'
import LOGGER from '../utils/logger'

require('dotenv').config()

const { DB_CONFIG } = CONFIG
const knex = require('knex')(DB_CONFIG)

knex.on('query', LOGGER.DB.query)
knex.on('query-error', LOGGER.DB.error.bind(LOGGER.DB))
knex.on('query-response', LOGGER.DB.queryResponse)

function initialize () {
  // todo
  require('../db-schemas/todo').todoModel(knex)

}
initialize()
module.exports = knex
