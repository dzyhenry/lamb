const promisesAplusTests = require('promises-aplus-tests');
const adapter = require('../lamb');

promisesAplusTests(adapter, function (err) {
  console.log(err);
});
