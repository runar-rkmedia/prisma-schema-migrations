import { lstatSync, readdirSync } from 'fs'
import graphqlGot from 'graphql-got'
import { join } from 'path'
import { config } from './cli'
import createLogger from './logger'
const logger = createLogger('prismaClient')

export const client = (
  input: { query: string; variables?: any; endpoint?: string } | string,
  noExit?: boolean
) => {
  const endpoint =
    (typeof input !== 'string' && input.endpoint) || config.prismaEndpoint
  if (!endpoint) {
    logger.fatal('No prisma-endpoint set')
    throw new Error('No prisma-endpoint set')
  }
  const args =
    typeof input === 'string'
      ? {
          query: input,
        }
      : {
          ...input,
        }
  return graphqlGot(endpoint, args)
    .catch(err => {
      logger.error({ err, args }, 'Erorr occured.')
      const { query, ...rest } = args
      console.error(
        'This error occured with these params to ${endpoint}: ',
        query,
        rest
      )
      process.exit()
    })
    .then(({ body, errors }: any) => {
      if (errors) {
        if (noExit) {
          throw errors
        }
        logger.error(errors)
        console.error(errors[0].message)
        const { query, ...rest } = args
        console.error(
          'This error occured with these params to ${endpoint}: ',
          query,
          rest
        )
        process.exit()
      }
      return body
    })
}

export const getHeadDirs = (migrationPath = config.migrationsDir) => {
  return readdirSync(migrationPath)
    .map(name => join(migrationPath, name))
    .filter(p => lstatSync(p).isDirectory())
}

export const formatDate = (date: Date) => {
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date
    .getUTCDate()
    .toString()
    .padStart(2, '0')
  const h = date
    .getUTCHours()
    .toString()
    .padStart(2, '0')
  const mm = date
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')
  const s = date
    .getUTCSeconds()
    .toString()
    .padStart(2, '0')
  return `${y}-${m}-${d}-${h}${mm}${s}`
}

export const getMigrationHead = async ({
  noExit,
}: { noExit?: boolean } = {}) => {
  const result = await client(
    `
    query {
      migrations{
        migrationName
  }
}`,
    noExit
  )
  const { migrations } = result
  if (!migrations) {
    if (noExit) {
      return result
    }
    process.exit()
  }
  if (migrations.length < 1) {
    console.error('Could not find the head (migrationName) in the db')
    console.error(
      'If you are sure of what the current head should be, run set-head'
    )
    process.exit()
  }
  if (migrations.length > 1) {
    console.error('Found more than one migrations. Exactly one is required.')
    console.log(result)
    process.exit()
  }
  return migrations[0].migrationName
}
