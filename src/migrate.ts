import vm from 'vm'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from './cli'
import setHead, { checkValidHead } from './setHead'
import { client, getHeadDirs, getMigrationHead } from './utils'
import createLogger from './logger'

const logger = createLogger('migrate')

export const deployFromDir = (directory, params = '') =>
  new Promise((resolve, reject) => {
    exec(
      `PRISMA_ENDPOINT=${config.prismaEndpoint} prisma deploy ${params}`,
      {
        cwd: directory,
      },
      (err, stdout, stderr) => {
        if (err && err.toString().indexOf('prisma: command not found') !== -1) {
          console.log({ error: err, stdout, stderr })
          throw new Error('Prisma not installed. Please install it.')
        }
        if (err) {
          logger.error(err, stderr)
          console.log(stdout)
          reject({ error: err, stdout, stderr })
        }
        resolve(stdout)
      }
    )
  })

const runJsFile = async (
  file: string,
  action: 'upBefore' | 'upAfter' | 'downBefore' | 'downAfter'
) => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping logic since the file could not be found: ${file}`)
    return {}
  }
  const code = fs.readFileSync(file, 'utf8')
  const sandboxedFunc = vm.runInContext(
    code,
    vm.createContext({
      console,
      module,
      require,
    })
  )
  let result: { prismaParams?: string }
  try {
    result = await sandboxedFunc({
      action,
      client,
      logger: createLogger(`${file}/${action}`),
    })
  } catch (err) {
    logger.error({ err, file }, 'Error during job')
    throw new Error(err)
  }
  if (!result) {
    throw new Error(`Did not recieve result from job ${file}`)
  }
  return { ...result }
}

const migrateFromDir = async (
  dir,
  { down, prismaParams }: { down?: boolean; prismaParams?: string } = {}
) => {
  const folderName = path.basename(dir)
  const result = await runJsFile(
    path.join(config.migrationsDir, folderName, 'job.js'),
    down ? 'downBefore' : 'upBefore'
  )
  try {
    const deployResult = await deployFromDir(
      dir,
      prismaParams || result.prismaParams
    )
    logger.info(
      { deployResult, folderName },
      'Migrated to  {folderName} successfully'
    )
  } catch (err) {
    logger.error(
      { err, error: err.stderr, stderr: err.stderr, folderName },
      'There was a problem deploying {folderName}'
    )
    console.error(
      `There was a problem deploying ${folderName}: `,
      err.error,
      err.stderr
    )
    console.error(`This error occured when migrating ${dir}`)
    process.exit()
  }
  await runJsFile(
    path.join(config.migrationsDir, folderName, 'job.js'),
    down ? 'downAfter' : 'upAfter'
  )
  const migration = await setHead(folderName)
  return migration
}

interface IMigrationOptions {
  migrateDownwards: boolean
  to: string
  prismaParams: string
}

const performMigrations = async ({
  migrateDownwards,
  to,
  ...rest
}: Partial<IMigrationOptions> = {}) => {
  const head = await getMigrationHead()
  let dirs = getHeadDirs(config.migrationsDir)
  if (!!migrateDownwards) {
    dirs.reverse()
  }
  let dirNames = dirs.map(k => path.basename(k))
  let toIndex = dirNames.length
  if (to) {
    checkValidHead(to)
    toIndex = dirNames.indexOf(to)
  }
  const index = dirNames.indexOf(head)
  dirs = dirs.slice(index + 1, toIndex + 1)
  dirNames = dirNames.slice(index + 1, toIndex + 1)
  if (to) {
    logger.info(
      { dirCount: dirs.length, head, to },
      'Found {dirCount} available migrations between current head at {head} and {to}'
    )
  } else {
    logger.info(
      {
        dirCount: dirs.length,
        head,
        direction: migrateDownwards ? 'before' : 'after',
      },
      'Found {dirCount} available migrations {direction} current head at {head}'
    )
  }

  dirNames.forEach(console.info)

  for (const dir of dirs) {
    await migrateFromDir(dir, { down: migrateDownwards, ...rest })
  }
}

export default performMigrations
