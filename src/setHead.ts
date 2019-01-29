import {basename} from 'path'
import { client } from './utils'
import { getHeadDirs } from './utils'

const setHead = async (head: string) => {
  checkValidHead(head)

  return await client(`
    mutation {
      deleteManyMigrations{count}
      createMigration(data: {migrationName: "${head}"}){id}
    }`)
}

export default setHead

export const checkValidHead = (head: string) => {
  const dirs = getHeadDirs()
  .map((n) => basename(n))
  if (!dirs.includes(head)) {
    console.error('Not valid head-position, must be on of', dirs)

    process.exit()
  }
}
