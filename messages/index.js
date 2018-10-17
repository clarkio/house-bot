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
    constants.entities.LIGHT_NAME
  );
  const color = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.COLOR_NAME
  );
  const effect = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.entities.EFFECT_NAME
  );

  if (!color) {
    lightState = builder.EntityRecognizer.findEntity(
      args.entities,
      constants.entities.STATE_NAME
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

  if (location && lightState) {
    // we call LIFX
    // color.entity.replace is to try and handle hex color codes since LUIS separate #, numbers
    controlLights(
      session,
      location.entity,
      lightState.entity,
      color && color.entity.replace(' ', '')
    );
  } else if (effect) {
    triggerLightEffect(session, effect.entity);
  } else {
    session.send(constants.messages.LIGHT_COMMAND_NOT_UNDERSTOOD);
    session.endDialog();
  }
}

function triggerLightEffect(session, effect) {
  let pulseOptions = {};
  logger.log('info', constants.logs.RAW_EFFECT_RECEIVED(effect));
  const message = constants.logs.INITIATED_EFFECT(effect);
  const period = parseFloat(process.env.LifxEffectPeriod);
  const cycles = parseFloat(process.env.LifxEffectCycles);

  // TODO: ** Make the AI determine this with "effectType" and "effectColors" **
  // Example: bulb pulse purple white
  if (constants.effects.COP_MODE.includes(effect)) {
    pulseOptions = constants.lifxPulseEffectOptions.COP_MODE;
  } else if (constants.effects.NEW_FOLLOWER.includes(effect)) {
    pulseOptions = constants.lifxPulseEffectOptions.NEW_FOLLOWER;
  } else if (constants.effects.NEW_SUBSCRIBER.includes(effect)) {
    pulseOptions = constants.lifxPulseEffectOptions.NEW_SUBSCRIBER;
  } else {
    // Not a defined effect so do nothing
    const warningMessage = constants.logs.UNSUPPORTED_EFFECT(effect);
    logger.log('warn', warningMessage);
    logger.log('warn', constants.logs.FULL_MESSAGE_RECEIVED(message));
    session.send(warningMessage);
    session.endDialog();
  }
  pulseOptions.period = period;
  pulseOptions.cycles = cycles;

  if (pulseOptions.power_on) {
    logger.log('info', constants.logs.INITIATING_EFFECT);
    client
      .pulse(constants.LIFX_DEVICE_TO_USE, pulseOptions)
      .then(result => {
        session.send(result);
        session.endDialog();
      })
      .catch(error => {
        logger.log('error', error);
        session.send(`There was an error initiating the effect: ${error}`);
        session.endDialog();
      });
  } else {
    logger.log('info', constants.logs.NO_EFFECT_INITIATED);
  }
}

function controlLights(session, location, lightState, color) {
  let message = `The ${location} was turned ${lightState}`;
  logger.log('info', color);

  const stateToSet = {
    power: `${lightState}`,
    brightness: 1.0,
    duration: 1
  };
  if (color) {
    stateToSet.color = `${color}`;
    message += ` and was set to ${color}`;
  }
  setLifxLights(stateToSet, message, session);
}

function setLifxLights(stateToSet, message, session) {
  client
    .setState(constants.LIFX_DEVICE_TO_USE, stateToSet)
    .then(result => {
      session.send(result);
      session.endDialog();
    })
    .catch(error => {
      logger.log('error', error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();
    });
}

module.exports = connector.listen();
