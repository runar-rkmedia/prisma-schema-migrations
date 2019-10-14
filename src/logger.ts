import Logger from '@indico/logging-js'
const pkg = require('../package.json')

const l = new Logger({
  name: process.env.SCHEMA_MIGRATOR_LOGGER_NAME || pkg.name,
  version: pkg.version,
})

const createLogger = l.createChildLogger
export default createLogger
