const builder = require('botbuilder');
require('dotenv').config();
const botBuilderAzure = require('botbuilder-azure');
const Lifx = require('lifx-http-api');

const constants = require('./constants');

const {
  LifxApiKey,
  LuisAPIHostName,
  LuisAppId,
  LuisAPIKey,
  MicrosoftAppId,
  MicrosoftAppPassword
} = process.env;
const captains = console;

const client = new Lifx({
  bearerToken: LifxApiKey
});

const connector = new botBuilderAzure.BotServiceConnector({
  appId: MicrosoftAppId,
  appPassword: MicrosoftAppPassword
});

const bot = new builder.UniversalBot(connector, {
  storage: new builder.MemoryBotStorage()
});

const luisModelUrl = `https://${LuisAPIHostName}/luis/v2.0/apps/${LuisAppId}?subscription-key=${LuisAPIKey}`;

// Main dialog with LUIS
const recognizer = new builder.LuisRecognizer(luisModelUrl);
const intents = new builder.IntentDialog({ recognizers: [recognizer] })
  .matches(constants.INTENT_GREETING, session => {
    session.send(constants.MESSAGE_GREETING);
  })
  .matches(constants.INTENT_HELP, session => {
    session.send(constants.MESSAGE_HELP);
  })
  .matches(constants.INTENT_CANCEL, session => {
    session.send(constants.MESSAGE_CANCEL);
    session.endDialog();
  })
  .matches(constants.INTENT_LIGHTS, (session, args) => {
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
      session.send(constants.MESSAGE_COMMAND_NOT_UNDERSTOOD);
      session.endDialog();
    }
  })
  .onDefault(session => {
    session.send("Sorry, I did not understand '%s'.", session.message.text);
    session.endDialog();
  });

bot.dialog('/', intents);

function triggerLightEffect(session, effect) {
  let pulseOptions;
  captains.log(`Raw effect received: ${effect}`);
  const message = `Successfully initiated "${effect}" effect`;
  const period = parseFloat(process.env.LifxEffectPeriod);
  const cycles = parseFloat(process.env.LifxEffectCycles);

  if (effect === 'cop mode') {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_COP_MODE;
  } else if (effect === 'new follower') {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_NEW_FOLLOWER;
  } else if (effect === 'new subscriber') {
    pulseOptions = constants.PULSE_EFFECT_OPTIONS_NEW_SUBSCRIBER;
  } else {
    // Not a defined effect so do nothing
    const warningMessage = `Received an unsupported effect: ${effect}`;
    captains.warn(warningMessage);
    captains.warn(`Full message received: ${message}`);

    session.send(warningMessage);
    session.endDialog();
  }
  pulseOptions.period = period;
  pulseOptions.cycles = cycles;

  if (pulseOptions.power_on) {
    captains.log('Initiating the effect');
    client
      .pulse(constants.LIFX_DEVICE_TO_USE, pulseOptions)
      .then(result => {
        session.send(result);
        session.endDialog();
      })
      .catch(error => {
        captains.error(error);
        session.send(`There was an error initiating the effect: ${error}`);
        session.endDialog();
      });
  } else {
    captains.log('Options was undefined and therefore no effect was initiated');
  }
}

function controlLights(session, location, lightState, color) {
  let message = `The ${location} was turned ${lightState}`;
  captains.log(color);
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
      captains.error(error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();
    });
}

module.exports = connector.listen();
