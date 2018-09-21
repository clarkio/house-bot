const builder = require('botbuilder');
require('dotenv').config();
const botBuilderAzure = require('botbuilder-azure');
const Lifx = require('lifx-http-api');

const {
  LifxApiKey,
  LuisAPIHostName,
  LuisAppId,
  LuisAPIKey,
  MicrosoftAppId,
  MicrosoftAppPassword
} = process.env;
const captains = captains;

const client = new Lifx({
  bearerToken: LifxApiKey
});
const lifxDeviceToUse = 'label:Bottom Bulb';

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
  .matches('Greeting', session => {
    session.send('Sup, yo!');
  })
  .matches('Thank You', session => {
    session.send('No problem! Glad I could help.');
  })
  .matches('Help', session => {
    session.send(
      'I can control the lights in your house. You can say things like, "Turn the kitchen lights on".'
    );
  })
  .matches('Cancel', session => {
    session.send('OK. Canceled.');
    session.endDialog();
  })
  .matches('Lights', (session, args) => {
    session.send('OK! One sec...');

    let lightState;
    let location = builder.EntityRecognizer.findEntity(args.entities, 'light');
    const color = builder.EntityRecognizer.findEntity(args.entities, 'color');
    const effect = builder.EntityRecognizer.findEntity(args.entities, 'effect');

    if (!color) {
      lightState = builder.EntityRecognizer.findEntity(args.entities, 'state');
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
      session.send(
        `I did not understand that light command. Please double check the available commands and retry.`
      );
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
    pulseOptions = {
      color: 'blue',
      from_color: 'red',
      period,
      cycles,
      power_on: true
    };
  } else if (effect === 'new follower') {
    pulseOptions = {
      color: 'purple',
      from_color: 'white',
      period,
      cycles,
      power_on: true
    };
  } else if (effect === 'new subscriber') {
    pulseOptions = {
      color: 'green',
      from_color: 'purple',
      period,
      cycles,
      power_on: true
    };
  } else {
    // Not a defined effect so do nothing
    const warningMessage = `Received an unsupported effect: ${effect}`;
    captains.warn(warningMessage);
    captains.warn(`Full message received: ${message}`);

    session.send(warningMessage);
    session.endDialog();
  }

  if (pulseOptions) {
    captains.log('Initiating the effect');
    client
      .pulse(lifxDeviceToUse, pulseOptions)
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
    .setState('label:Bottom Bulb', stateToSet)
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
