import { paramCase } from 'change-case'
import yaml from 'js-yaml'

import fs from 'fs'
import path from 'path'
import { MIGRATION_PATH, schemaDir } from './cli'
import { formatDate } from './utils'
const userTemplate = path.join(MIGRATION_PATH, 'template.js')
const templateJs = fs.existsSync(userTemplate) ? userTemplate : path.join(__dirname, '../template.js')


const copySchemas = (migrationDir) => {
  const files = fs.readdirSync(schemaDir)
    .filter((file) => file.endsWith('.graphql'))

  if (!files.length) {
    throw new Error(`no files found in ${schemaDir}`)
  }
  files.forEach((file) => fs.copyFileSync(
    path.join(schemaDir, file), path.join(migrationDir, file)))
  const prismaYaml = {
    datamodel: files,
    endpoint: '${env: PRISMA_ENDPOINT}',
  }
  fs.writeFileSync(path.join(migrationDir, 'prisma.yml'), yaml.safeDump(prismaYaml))
}

const createMigration = (name) => {
  if (!name) {
    throw new Error('You should give a name to your migration')
  }
  if (typeof name !== 'string') {
    throw new Error(`Expected name to be string, got ${typeof name}.`)
  }
  const filename = paramCase(name)
  const date = formatDate(new Date())
  const directory = path.join(MIGRATION_PATH, `${date}_${filename}`)
  fs.mkdirSync(directory)
  copySchemas(directory)
  fs.copyFileSync(templateJs, path.join(directory, 'job.js'))
}

export default createMigration
