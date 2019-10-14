#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import yargs from 'yargs'
import findUp from 'find-up'
import chalk from 'chalk'
const configPath = findUp.sync([
  '.prisma-schema-migrator',
  '.prisma-schema-migrator.json',
])
export const config: IConfig = {
  schemaDir: 'database',
  prismaEndpoint: process.env.PRISMA_ENDPOINT || '',
  generateDiff: true,
  ...(!!configPath && JSON.parse(fs.readFileSync(configPath).toString())),
}

const { blue: infoColor, red: errorColor } = chalk
config.migrationsDir =
  config['migrations-dir'] || path.join(config.schemaDir, 'migrations')

import { getHeadDirs, getMigrationHead } from './utils'
import createMigration from './create'
import performMigrations, { deployFromDir } from './migrate'
import setHead from './setHead'

interface IConfig {
  schemaDir: string
  prismaEndpoint: string
  migrationsDir: string
  generateDiff: boolean | string
}

const init = async () => {
  const { schemaDir, migrationsDir } = config
  console.table(config)

  let migrationHead: string = ''

  console.info(
    '\nGetting information about youur current prisma-migations-status...\n'
  )
  try {
    migrationHead = await getMigrationHead({ noExit: true })
  } catch (e) {
    console.log(errorColor(JSON.stringify(e)))
    const message = e[0] && e[0].message && (e[0].message as string)

    if (message.startsWith('Project not found:')) {
      console.log(
        errorColor('\nPrisma-endpoint was reachable, but not deployed.'),
        infoColor(
          '\nUse "deploy -l" if you want to deploy the latest migration right away. '
        )
      )
    }

    if (message.startsWith("Cannot query field 'migrations' on type 'Query'")) {
      console.log(
        errorColor(
          '\nIt seems your prisma-instance is deployed, but required field migrations not created.'
        ),
        infoColor('\nPlease specify this in your schema and deploy.')
      )
    }

    if (message.startsWith('bbb')) {
      console.log(
        errorColor(
          '\nIt seems your prisma-instance is deployed, but no head set (migrations.migrationName)'
        ),
        infoColor(
          '\nYou might want to set the head manually with set-head (make sure you set it correctly).'
        )
      )
    }
  }
  migrationHead && console.log(`Current head is ${infoColor(migrationHead)}`)

  const validateFolder = (folder, folderName) => {
    if (!fs.existsSync(folder)) {
      console.error(
        errorColor(
          `The ${folderName} does not exist. Please create it first, or set it correctly with -${folderName}.`,
          folder
        )
      )
      process.exit()
    }
    if (!fs.lstatSync(folder).isDirectory()) {
      console.error(
        errorColor(`The ${folderName} seems not to be a directory.`, folder)
      )
      process.exit()
    }
  }

  validateFolder(schemaDir, 'schemaDir')
  validateFolder(migrationsDir, 'migrations-dir')
  const dirs = getHeadDirs().map(k => path.basename(k))

  const argv = yargs
    .config(config)
    .command('create <name>', 'Create a new migration on disk', y =>
      y
        .positional('name', {
          describe: 'Name of the mutation',
          type: 'string',
        })
        .coerce('name', n => {
          if (n.length > 20) {
            throw Error('max length of name is 20')
          }
          return n
        })
    )
    .command('setHead [name]', 'Set head of db to.', y =>
      y
        .positional('name', {
          choices: dirs,
          conflicts: 'l',
          describe: 'Set to migrate to a specific head-position',
          type: 'string',
        })
        .alias('l', 'latest')
        .describe('l', 'Set to latest head-position')
        .boolean('l')
        .check(s => {
          if (!s.l && !s.name) {
            throw new Error('No name set. You might want to use --latest')
          }
          return true
        })
    )
    .command('deploy [name]', 'Deploy migration. Used for new setups', y =>
      y
        .positional('name', {
          choices: dirs,
          conflicts: 'l',
          describe: 'Set to migrate to a specific head-position',
          type: 'string',
        })
        .alias('l', 'latest')
        .describe('l', 'Set to latest head-position')
        .boolean('l')
        .check(s => {
          if (!s.l && !s.name) {
            throw new Error('No name set. You might want to use --latest')
          }
          return true
        })
        .alias('f', 'force')
        .describe('f', 'Set to force deployments')
        .boolean('f')
        .alias('m', 'migrate')
        .describe('m', 'Set to do migration if already deployed')
        .boolean('m')
    )
    .command('migrate', 'Migrate prisma', y =>
      y
        .alias('d', 'down')
        .describe('d', 'Set to migrate backwards')
        .boolean('d')
        .alias('f', 'force')
        .describe('f', 'Set to force deployments')
        .boolean('f')
        .option('to', {
          choices: dirs,
          describe: 'Set to migrate to a specific head-position',
        })
    )
    .help('help').argv

  const {
    _: [command],
    to,
    down,
    force,
    name: _name,
    latest,
  } = argv as any

  const name = latest ? dirs[dirs.length - 1] : _name
  const prismaParams = `${force ? '-f' : ''}`
  switch (command) {
    case 'create':
      createMigration(name)
      break
    case 'migrate':
      performMigrations({
        prismaParams,
        migrateDownwards: !!down,
        to: to as string,
      })
      break
    case 'setHead':
      setHead(name).then(result => {
        console.log(result)
      })
      break
    case 'deploy':
      const dir = getHeadDirs().find(p => p.endsWith(name))
      console.log(`Deploying ${name}`)
      deployFromDir(dir, prismaParams).then(r => {
        console.log(r)
        setHead(name).then(result => {
          console.log(result)
        })
      })

      break
    default:
      break
  }
}

init()
