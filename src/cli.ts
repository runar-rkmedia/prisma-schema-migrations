#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import yargs from 'yargs'

let dirs: string[] = []

const argv = yargs
  .string('s')
  .alias('s', 'schema-dir')
  .describe('s', 'The directory to your schema')
  .default('s', path.join(process.cwd(), 'database'))
  .string('m')
  .alias('m', 'migrations-dir')
  .describe('m', 'The directory to output your migrations')
  .command(
    'create <name>',
    'Create a new migration on disk',
    (y) =>
      y.positional('name', {
        describe: 'Name of the mutation',
        type: 'string',
      })
        .coerce('name', (n) => {
          if (n.length > 20) {
            throw Error('max length of name is 20')
          }
          return n
        }),
  )
  .command(
    'set-head <name>',
    'Set head of db to.',
    (y) =>
      y.positional('name', {
        choices: dirs,
        conflicts: 'l',
        describe: 'Set to migrate to a specific head-position',
        type: 'string',
      })
        .alias('l', 'latest')
        .describe('l', 'Set to latest head-position')
        .boolean('l')
        .check((s) => {
          if (!s.l && !s.name) {
            throw new Error('JSON.stringify(s)')
          }
          return true
        }),
  )
  .command(
    'deploy [name]',
    'Deploy migration. Used for new setups',
    (y) =>
      y.positional('name', {
        choices: dirs,
        conflicts: 'l',
        describe: 'Set to migrate to a specific head-position',
        type: 'string',
      })
        .alias('l', 'latest')
        .describe('l', 'Set to latest head-position')
        .boolean('l')
        .check((s) => {
          if (!s.l && !s.name) {
            throw new Error('JSON.stringify(s)')
          }
          return true
        })
        .alias('f', 'force')
        .describe('f', 'Set to force deployments')
        .boolean('f')
        .alias('m', 'migrate')
        .describe('m', 'Set to do migration if already deployed')
        .boolean('m'),
  )
  .command(
    'migrate',
    'Migrate prisma',
    (y) => y
      .alias('d', 'down')
      .describe('d', 'Set to migrate backwards')
      .boolean('d')
      .alias('f', 'force')
      .describe('f', 'Set to force deployments')
      .boolean('f')
      .option('to', {
        choices: dirs,
        describe: 'Set to migrate to a specific head-position',
      }),
  )
  .help('help')
  .strict()
  .argv

const {
   _: [command],
   to, down, force, name: _name, latest, s, m,
  } = argv as any

export const schemaDir = s
export const MIGRATION_PATH = m || path.join(s, 'migrations')

const validateFolder = (folder, folderName) => {
  if (!fs.existsSync(folder)) {
    console.error(
      `The ${folderName} does not exist. Please create it first, or set it correctly with -${folderName}.`,
      folder,
    )
    process.exit()
  }
  if (!fs.lstatSync(folder).isDirectory()) {
    console.error(
      `The ${folderName} seems not to be a directory.`,
      folder,
    )
    process.exit()
  }
}

validateFolder(schemaDir, 'schema-dir')
validateFolder(MIGRATION_PATH, 'migrations-dir')

import createMigration from './create'
import performMigrations, { deployFromDir } from './migrate'
import setHead from './setHead'
import { getHeadDirs } from './utils'

dirs = getHeadDirs().map((k) => path.basename(k))




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
      to: (to as string),
    })
    break
  case 'setHead':
    setHead(name)
      .then((result) => {
        console.log(result)
      })
    break
  case 'deploy':
    const dir = getHeadDirs().find((p) => p.endsWith(name))
    console.log(`Deploying ${name}`)
    deployFromDir(dir, prismaParams)
      .then(
        (r) => {
          console.log(r)
          setHead(name)
            .then((result) => {
              console.log(result)
            })
        },
      )

    break
  default:
    break
}
