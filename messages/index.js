const builder = require('botbuilder');
require('dotenv').config();
const botBuilderAzure = require('botbuilder-azure');
const Lifx = require('lifx-http-api');

const constants = require('./constants');
const logger = require('./log').default;

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
  .matches(constants.INTENT_GREETING, handleGreetingIntent)
  .matches(constants.INTENT_HELP, handleHelpIntent)
  .matches(constants.INTENT_CANCEL, handleCancelIntent)
  .matches(constants.INTENT_LIGHTS, handleLightsIntent)
  .onDefault(handleDefaultIntent);

bot.dialog('/', intents);

function handleGreetingIntent(session) {
  session.send(constants.MESSAGE_GREETING);
}

function handleHelpIntent(session) {
  session.send(constants.MESSAGE_HELP);
}

function handleCancelIntent(session) {
  session.send(constants.MESSAGE_CANCEL);
  session.endDialog();
}

function handleDefaultIntent(session) {
  session.send(`Sorry, I did not understand ${session.message.text}.`);
  session.endDialog();
}

function handleLightsIntent(session, args) {
  session.send(constants.MESSAGE_LIGHTS_ACKNOWLEDGE);

  let lightState;
  let location = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.ENTITY_LIGHT_NAME
  );
  const color = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.ENTITY_COLOR_NAME
  );
  const effect = builder.EntityRecognizer.findEntity(
    args.entities,
    constants.ENTITY_EFFECT_NAME
  );

  if (!color) {
    lightState = builder.EntityRecognizer.findEntity(
      args.entities,
      constants.ENTITY_STATE_NAME
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
    session.send(constants.MESSAGE_LIGHT_COMMAND_NOT_UNDERSTOOD);
    session.endDialog();
  }
}

function triggerLightEffect(session, effect) {
  



  console.log(constants.LOG_EFFECT_TRIGGERED`${effect}`);
 



















  let pulseOptions;
  logger.log('info', `Raw effect received: ${effect}`);
  const message = `Successfully initiated "${effect}" effect`;
  const period = parseFloat(process.env.LifxEffectPeriod);
  const cycles = parseFloat(process.env.LifxEffectCycles);

  if (effect === constants.EFFECT_COP_MODE) {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_COP_MODE;
  } else if (effect === constants.EFFECT_NEW_FOLLOWER) {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_NEW_FOLLOWER;
  } else if (effect === constants.EFFECT_NEW_SUBSCRIBER) {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_NEW_SUBSCRIBER;
  } else {
    // Not a defined effect so do nothing
    const warningMessage = constants.LOG_UNSUPPORTED_EFFECT`${effect}`;
    logger.log('warn', warningMessage);
    logger.log('warn', constants.LOG_FULL_MESSAGE_RECEIVED`${message}`);
    session.send(warningMessage);
    session.endDialog();
  }
  pulseOptions.period = period;
  pulseOptions.cycles = cycles;

  if (pulseOptions.power_on) {
    logger.log('info', 'Initiating the effect');
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
    logger.log(
      'info',
      'Options was undefined and therefore no effect was initiated'
    );
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
