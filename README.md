# Prisma-migrations

Unofficial migrations-handler for prisma

Prisma is great and supports basic migrations on its own. However, as of writing,
it cannot do any logic in these migrations, like converting a users name into
two new fields, firstName and lastName etc.

Prisma is working on implementing it, see [issue Database migrations](https://github.com/prisma/prisma/issues/1263).

In the meantime, I created a cli, which creates migrations as steps. This is
influenced by other migration-tools like [alembic](https://alembic.sqlalchemy.org/en/latest/),
but only implements basic functionality.

## Getting started

```bash
npm add --save-dev prisma-schema-migrator
```

```bash
yarn add -D prisma-schema-migrator
```

Either add a command for `prisma-schema-migrator` to your `package.json`

``` JSON
...
"scripts": {
  ...
  "migrate": "prisma-schema-migrator",
  ...
}
```

or run it on your own with `npx prisma-schema-migrator`

Now we need to add a table to the schema. This is used to keep track of the
current head of the migrations-steps.

```
type Migration  {
  id: ID! @unique
  createdAt: DateTime!
  migrationName: String! @unique
}
```

## The CLI

The cli has a help-screen, accessable from `prisma-schema-migrator --help`, which will
list all options.

By default, it expects your schema-directory to be in `./database`. You can
set it with `-s` or `-schema-dir`.

### Creating migrations

```
prisma-schema-migrator create <name>
```

This will create a migration in the `<schema-dir>/migrations`-directory, with a
name being `<current-date>_<name>`. The name you specify should be short and
descriptive of the migration-step. The name of the folder will be used as the
`migrationName` in the `Migration`-table. You should not rename this folder.
The date is needed to sort the migrations, so that each step will be performed
in the correct order.

#### Logic-step (job.js)

Each migration should have a `job.js`, and this will be created for you from
a template. You can supply your own template by putting it in `mgirations/template.js`.

The function recieves one function containing:

```js
{
  action: 'upBefore' | 'upAfter' | 'downBefore' | 'downAfter',
  client: (input: { query: string, variables?: any } | string) => Promise
}
```

When migrating forwards, the action will be `upX`, and backwards `downX`.
Before and after refers to before `prisma deploy`, is ran this migration-step.

In each of these steps, you should return a truthy-value, unless there was an error.
if a falsy return-value is provided, the program will stop.

You may also return an object of arguments:

```
prismaParams: any arguments you want to pass to `prisma deploy`, like -f (be careful)
```
