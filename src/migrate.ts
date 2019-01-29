import vm from 'vm'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { MIGRATION_PATH } from './cli'
import setHead, { checkValidHead } from './setHead'
import { client, getHeadDirs, getMigrationHead } from './utils'

export const deployFromDir = (directory, params = '') => new Promise(
  (resolve, reject) => {
    exec(
      `prisma deploy ${params}`,
      {
        cwd: directory,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log(stdout)
          reject({ error, stdout, stderr })
        }
        resolve(stdout)

      },
    )
  },
)

const runJsFile = async (file, action: 'upBefore' | 'upAfter' | 'downBefore' | 'downAfter') => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping logic since the file could not be found: ${file}`)
    return {}
  }
  const code = fs.readFileSync(file, 'utf8')
  const sandboxedFunc = vm.runInContext(code, vm.createContext({
    console,
    module,
    require,
  }))
  let result: {prismaParams?: string}
  try {
    result = await sandboxedFunc({
      action,
      client,
    })
  } catch (e) {
    throw new Error(e)
  }
  if (!result) {
    throw new Error(`Did not recieve result from job ${file}`)
  }
  return {...result}
}

const migrateFromDir = async (dir, {down, prismaParams}: {down?: boolean, prismaParams?: string} = {}) => {
  const folderName = path.basename(dir)
  const result = await runJsFile(
    path.join(MIGRATION_PATH, folderName, 'job.js'),
    down ? 'downBefore' : 'upBefore')
  try {
    const deployResult = await deployFromDir(dir, prismaParams || result.prismaParams)
    console.log(deployResult)
    console.log(`Deployed ${folderName} successfully`)
  } catch (e) {
    console.error(e)
    console.error(
      `There was a problem deploying ${folderName}: `,
      e.error,
      e.stderr,
    )
    console.error(
      `This error occured when migrating ${dir}`,
    )
    process.exit()
  }
  await runJsFile(
    path.join(MIGRATION_PATH, folderName, 'job.js'),
    down ? 'downAfter' : 'upAfter')
  const migration = await setHead(folderName)
  return migration
}

interface IMigrationOptions {
  migrateDownwards: boolean
  to: string
  prismaParams: string
}

const performMigrations = async ({ migrateDownwards, to, ...rest }: Partial<IMigrationOptions> = {}) => {
  const head = await getMigrationHead()
  let dirs = getHeadDirs()
  if (!!migrateDownwards) {
    dirs.reverse()
  }
  let dirNames = dirs.map((k) => path.basename(k))
  let toIndex = dirNames.length
  if (to) {
    checkValidHead(to)
    toIndex = dirNames.indexOf(to)
  }
  const index = dirNames.indexOf(head)
  dirs = dirs.slice(index + 1, toIndex + 1)
  dirNames = dirNames.slice(index + 1, toIndex + 1)

  console.log(
    !!to
      ? `Found ${dirs.length} available migrations between current head at ${head} and ${to}`
      : `Found ${dirs.length} available migrations ${migrateDownwards ? 'before' : 'after'} current head at ${head}`,
  )

  dirNames.forEach(console.info)

  for (const dir of dirs) {
    await (migrateFromDir(dir, {down: migrateDownwards, ...rest}))

  }
}

export default performMigrations
