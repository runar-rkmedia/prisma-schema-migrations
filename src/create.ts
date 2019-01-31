import { paramCase } from 'change-case'
import yaml from 'js-yaml'
import { exec } from 'child_process'

import fs from 'fs'
import path from 'path'
import { config } from './cli'
import { formatDate, getHeadDirs } from './utils'
const userTemplate = path.join(config.migrationsDir, 'template.js')
const templateJs = fs.existsSync(userTemplate) ? userTemplate : path.join(__dirname, '../template.js')
const templateJSContent = fs.readFileSync(templateJs).toString()

const copySchemas = (migrationDir) => {
  const files = fs.readdirSync(config.schemaDir)
    .filter((file) => file.endsWith('.graphql'))

  if (!files.length) {
    throw new Error(`no files found in ${config.schemaDir}`)
  }
  files.forEach((file) => fs.copyFileSync(
    path.join(config.schemaDir, file), path.join(migrationDir, file)))
  const prismaYaml = {
    datamodel: files,
    endpoint: '${env: PRISMA_ENDPOINT}',
  }
  fs.writeFileSync(path.join(migrationDir, 'prisma.yml'), yaml.safeDump(prismaYaml))
}

const generateDiff = (dirA: string, dirB: string): Promise<string> => {
  const command = typeof config.generateDiff === 'string' ? config.generateDiff : 'diff'
  return new Promise(
    (resolve, _reject) => {
      return exec(
        `${command} ${dirA} ${dirB}`,
        (_error, stdout, _stderr) => {
          resolve(stdout)
        },
      )
    },
  )
}

const createMigration = async (name)  => {
  if (!name) {
    throw new Error('You should give a name to your migration')
  }
  if (typeof name !== 'string') {
    throw new Error(`Expected name to be string, got ${typeof name}.`)
  }
  const filename = paramCase(name)
  const date = formatDate(new Date())
  const directory = path.join(config.migrationsDir, `${date}_${filename}`)
  fs.mkdirSync(directory)
  copySchemas(directory)
  let content = templateJSContent
  let diff = ''
  if (config.generateDiff) {
    const migrationDirs = getHeadDirs()
    if (migrationDirs.length >= 2) {
      diff = await generateDiff(
        migrationDirs[migrationDirs.length -2],
        migrationDirs[migrationDirs.length -1],
      )
      content = content.replace(/(.*)\{\{diff\}\}/, diff.replace(/^/gm, '$1'))
    }
  }
  fs.writeFileSync(path.join(directory, 'job.js'), content)
  console.info(`Files saved to ${directory}`)
}

export default createMigration
