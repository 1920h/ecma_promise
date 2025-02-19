
const promiseAplusTest =  require("promises-aplus-tests")
const main =  require('./index.cjs')

console.log(main)
promiseAplusTest.mocha(main)

// promiseAplusTest(main, function (err) {
//     console.log(err)
//     // All done; output is in the console. Or check `err` for number of failures.
// });