// To create a custom-template, create your template.js inside you
// migrations-dir, and it will be copied for you..
//
// If you don't need logic on this migration-step,
// simply delete this file, and it will be ignored.
//
// ### Example usage of client::
// const result = await client(`
//   mutation{
//     updateManyTests(data:{description: ""}){count}
//   }
//   `)
//   return result
module.exports = async args => {
  const {client, action} = args
  switch (action) {
    case 'downBefore':
    case 'downAfter':
    case 'upBefore':
    case 'upAfter':
      return true;
    default:
      return true;
  }
}
