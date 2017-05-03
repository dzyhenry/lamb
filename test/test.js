// const lamb = require('../lamb.js');

// const Promise = lamb.Lamb;

// const promise = new Promise((resolve, reject) => {
//   setTimeout(() => {
//     resolve(new Promise((resov, rej) => {
//       setTimeout(() => {
//         console.log('In promise 1, we return a new Promise: ');
//         resov(123);
//       }, 100);
//     }));
//   }, 100);
// });

// promise.then((data) => {
//   console.log('first then: ', data);
//   return new Promise((resolve, reject) => {
//     setTimeout(() => {
//       resolve(data + 12);
//     }, 100);
//   });
// }, (reason) => {
//   console.log('first reject reason: ', reason);
//   return reason + 123;
// }).then((data) => {
//   console.log('second then: ',data);
// }, (reason) => {
//   console.log('second reject reason: ', reason);
// });

const p = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject(10);
  }, 100);
}).then((data) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(data + 10);
    }, 100);
  });
}).then((data) => {
  console.log(data);
});
