/**
 * Sleep function that returns a promise that will be resolved after given delay
 * @param  {Number} delay Delay in milliseconds
 * @return {Promise}      Promise that will be resolved after delay
 * @example <caption>Promises example</caption>
 * doSomeThings()
 *  .then(() => sleep(100))
 *  .then(() => doOtherThings());
 * @example <caption>Async/await example</caption>
 * await doSomeThings();
 * await sleep(100);
 * await doOtherThings();
 */
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

module.exports = sleep;
