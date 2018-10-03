module.exports = {
  log
};

/**
 * This will log to Discord if connected and the console
 * @param level
 * @param message
 */
function log(level, message) {
  const captains = console;
  captains[level](message);
}
