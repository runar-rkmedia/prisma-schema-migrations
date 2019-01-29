import { lstatSync, readdirSync } from 'fs'
import graphqlGot from 'graphql-got'
import { join } from 'path'
import { MIGRATION_PATH } from './cli'

export const client = (input: { query: string, variables?: any } | string) => {
  const args = typeof input === 'string'
    ? {
      query: input,
    }
    : {
      ...input,
    }
  return graphqlGot(
    process.env.PRISMA_ENDPOINT,
    args,
  )
    .catch(
      (err) => {
        console.error(err)
        const { query, ...rest } = args
        console.error('This error occured with these params to graphql-endpoint: ', query, rest)
        process.exit()
      },
    )
    .then(
      (({ body, errors }: any) => {
        if (errors) {
          console.error(errors[0].message)
          const { query, ...rest } = args
          console.error('This error occured with these params to graphql-endpoint: ', query, rest)
          process.exit()
        }
        return body
      }
      ))
}

export const getHeadDirs = () => {
  return readdirSync(MIGRATION_PATH)
    .map((name) => join(MIGRATION_PATH, name))
    .filter((p) => lstatSync(p).isDirectory())
}

export const formatDate = (date: Date) => {
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date.getUTCDate().toString().padStart(2, '0')
  const h = date.getUTCHours().toString().padStart(2, '0')
  const mm = date.getUTCMinutes().toString().padStart(2, '0')
  const s = date.getUTCSeconds().toString().padStart(2, '0')
  return `${y}-${m}-${d}-${h}${mm}${s}`
}

export const getMigrationHead = async () => {
  const result = await client(`
    query {
      migrations{
        migrationName
  }
}`)
  const { migrations } = result
  if (migrations.length < 1) {
    console.error('Could not find the migrations')
    console.log(result)
    process.exit()
  }
  if (migrations.length > 1) {
    console.error('Found more than one migrations. Exactly one is required.')
    console.log(result)
    process.exit()
  }
  return migrations[0].migrationName
}
