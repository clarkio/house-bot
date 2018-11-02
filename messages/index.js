const builder = require('botbuilder');
require('dotenv').config();
const botBuilderAzure = require('botbuilder-azure');
const Lifx = require('lifx-http-api');

const constants = require('./constants');
const logger = require('./log');

const {
  LifxApiKey,
  LuisAPIHostName,
  LuisAppId,
  LuisAPIKey,
  MicrosoftAppId,
  MicrosoftAppPassword
} = process.env;
let isCycleEffectEnabled = false;
let isCycleEffectRunning = false;
const luisModelUrl = `https://${LuisAPIHostName}/luis/v2.0/apps/${LuisAppId}?subscription-key=${LuisAPIKey}`;
const lifxOptions = { bearerToken: LifxApiKey };
const botServiceOptions = {
  appId: MicrosoftAppId,
  appPassword: MicrosoftAppPassword
};
const universalBotOptions = {
  storage: new builder.MemoryBotStorage()
};

const client = new Lifx(lifxOptions);
const connector = new botBuilderAzure.BotServiceConnector(botServiceOptions);
const bot = new builder.UniversalBot(connector, universalBotOptions);

// Main dialogs with LUIS
const recognizer = new builder.LuisRecognizer(luisModelUrl);
const intents = new builder.IntentDialog({ recognizers: [recognizer] })
  .matches(constants.intents.GREETING, handleGreetingIntent)
  .matches(constants.intents.HELP, handleHelpIntent)
  .matches(constants.intents.CANCEL, handleCancelIntent)
  .matches(constants.intents.LIGHTS, handleLightsIntent)
  .onDefault(handleDefaultIntent);

bot.dialog('/', intents);

function handleGreetingIntent(session) {
  session.send(constants.messages.GREETING);
}

function handleHelpIntent(session) {
  session.send(constants.messages.HELP);
}

function handleCancelIntent(session) {
  session.send(constants.messages.CANCEL);
  session.endDialog();
}

function handleDefaultIntent(session) {
  session.send(constants.logs.messages.NOT_UNDERSTOOD(session.message.text));
  session.endDialog();
}

function handleLightsIntent(session, args) {
  session.send(constants.messages.LIGHTS_ACKNOWLEDGE);

  let lightState;
  let location = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.LIGHT_KEY
  );
  const color = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.COLOR_KEY
  );
  const colorEntities = args.entities.filter(
    entity => entity.type === constants.entities.COLOR_KEY
  );
  const effectType = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.EFFECT_TYPE_KEY
  );
  const effectState = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.EFFECT_STATE_KEY
  );

  if (!color || colorEntities.length === 0) {
    lightState = builder.EntityRecognizer.findEntity(
      args.entities,
      constants.entities.STATE_KEY
    );
  } else {
    lightState = {
      entity: 'on',
      type: 'state',
      startIndex: 0,
      endIndex: 1,
      score: 100
    };
    if (!location) {
      location = {
        entity: 'light'
      };
    }
  }

  if (location && lightState && colorEntities.length < 2) {
    // we call LIFX
    controlLights(
      session,
      location.entity,
      lightState.entity,
      color && color.entity
    );
  } else if (effectType) {
    triggerLightEffect(
      session,
      effectType.entity,
      colorEntities,
      effectState && effectState.entity
    );
  } else {
    session.send(constants.messages.LIGHT_COMMAND_NOT_UNDERSTOOD);
    session.endDialog();
  }
}

function triggerLightEffect(session, effect, colorEntities, effectState) {
  logger.log('info', constants.logs.RAW_EFFECT_RECEIVED(effect));
  const message = constants.logs.INITIATED_EFFECT(effect);
  const period = parseFloat(process.env.LifxEffectPeriod);
  const cycles = parseFloat(process.env.LifxEffectCycles);
  if (effect === constants.effectTypes.PULSE && colorEntities.length > 1) {
    const pulseOptions = {
      color: colorEntities[1].entity,
      from_color: colorEntities[0].entity,
      power_on: true,
      period,
      cycles
    };
    const restartLightCycle = shouldRestartLightCycle();
    initiatePulseEffect(pulseOptions, session, restartLightCycle);
  } else if (effect === constants.effectTypes.CYCLE) {
    toggleCycleEffect(session, effectState);
  } else {
    // Not a defined effect so do nothing
    const warningMessage = constants.logs.UNSUPPORTED_EFFECT(effect);
    logger.log('warn', warningMessage);
    logger.log('warn', constants.logs.FULL_MESSAGE_RECEIVED(message));
    logger.log('info', constants.logs.NO_EFFECT_INITIATED);
    session.send(warningMessage);
    session.endDialog();
  }
}

function initiatePulseEffect(pulseOptions, session, restartLightCycle) {
  logger.log('info', constants.logs.INITIATING_PULSE_EFFECT);
  client
    .pulse(constants.LIFX_DEVICE_TO_USE, pulseOptions)
    .then(result => {
      session.send(result);
      session.send(
        `Successfully triggered the special effect on the LIFX light`
      );
      session.endDialog();

      if (restartLightCycle) {
        toggleCycleEffect(session);
      }
    })
    .catch(error => {
      logger.log('error', error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();

      if (restartLightCycle) {
        toggleCycleEffect(session);
      }
    });
}

function toggleCycleEffect(session, effectState) {
  isCycleEffectEnabled = determineEffectState(effectState);
  if (isCycleEffectEnabled && !isCycleEffectRunning) {
    logger.log('info', constants.logs.INITIATING_CYCLE_EFFECT);
    session.send(constants.logs.INITIATING_CYCLE_EFFECT);
    setLifxLights(
      { power: 'on', color: 'blue' },
      'Start of color cycle: blue',
      session
    );
    isCycleEffectRunning = true;
    const cycleEffectInterval = setInterval(() => {
      if (!isCycleEffectEnabled) {
        clearInterval(cycleEffectInterval);
        isCycleEffectRunning = false;
        session.send('Cycle effect has stopped running');
      } else {
        cycleLightColor(session);
      }
    }, 6000);
  } else if (!isCycleEffectEnabled) {
    isCycleEffectRunning = false;
    session.send('Cycle effect is disabled');
  } else {
    session.send('Cycle effect is already enabled and running');
  }
}

function cycleLightColor(session) {
  client
    .setDelta(constants.LIFX_DEVICE_TO_USE, constants.lifxCycleEffectDefaults)
    .then(result => {
      logger.log('info', result);
      session.send('Rotated the light color by 60 degrees');
    })
    .catch(error => {
      logger.log('error', error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();
    });
}

function determineEffectState(effectState) {
  switch (effectState) {
    case 'off':
    case 'disable':
    case 'stop':
    case 'end':
    case 'disabled':
      return false;
    default:
      return true;
  }
}

function controlLights(session, location, lightState, color) {
  let message = `The ${location} was turned ${lightState}`;
  logger.log('info', color);

  const stateToSet = {
    power: `${lightState}`,
    duration: 0.5
  };
  if (color) {
    stateToSet.color = `${color}`;
    message += ` and was set to ${color}`;
  }
  const restartLightCycle = shouldRestartLightCycle();
  setLifxLights(stateToSet, message, session, restartLightCycle);
}

function shouldRestartLightCycle() {
  let restartLightCycle = false;
  if (isCycleEffectRunning) {
    isCycleEffectEnabled = false;
    isCycleEffectRunning = false;
    restartLightCycle = true;
  } else {
    restartLightCycle = false;
  }
  return restartLightCycle;
}

function setLifxLights(stateToSet, message, session, restartLightCycle) {
  client
    .setState(constants.LIFX_DEVICE_TO_USE, stateToSet)
    .then(result => {
      session.send(result);
      session.send(message);
      session.endDialog();

      // TODO: make the timeout time value more dynamic
      setTimeout(() => {
        if (restartLightCycle) {
          toggleCycleEffect(session);
        }
      }, 30000);
    })
    .catch(error => {
      logger.log('error', error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();

      // TODO: make the timeout time value more dynamic
      setTimeout(() => {
        if (restartLightCycle) {
          toggleCycleEffect(session);
        }
      }, 30000);
    });
}

module.exports = connector.listen();
