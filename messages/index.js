const builder = require('botbuilder');
require('dotenv').config();
const botbuilder_azure = require('botbuilder-azure');
const axios = require('axios');
const lifx = require('lifx-http-api');

const client = new lifx({
  bearerToken: process.env['LifxApiKey']
});
const lifxDeviceToUse = 'label:Bottom Bulb';
const iftttKey = process.env.iftttKey;
const hueEnabled = process.env.hueEnabled;

const connector = new botbuilder_azure.BotServiceConnector({
  appId: process.env['MicrosoftAppId'],
  appPassword: process.env['MicrosoftAppPassword']
});

const bot = new builder.UniversalBot(connector, {
  storage: new builder.MemoryBotStorage()
});

let luisModelUrl = `https://${process.env['LuisAPIHostName']}/luis/v2.0/apps/${
  process.env['LuisAppId']
}?subscription-key=${process.env['LuisAPIKey']}`;

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
    session.send('I can control the lights in your house. You can say things like, "Turn the kitchen lights on".');
  })
  .matches('Cancel', session => {
    session.send('OK. Canceled.');
    session.endDialog();
  })
  .matches('Lights', (session, args) => {
    session.send('OK! One sec...');

    let lightState;
    let location = builder.EntityRecognizer.findEntity(args.entities, 'light');
    let color = builder.EntityRecognizer.findEntity(args.entities, 'color');
    let effect = builder.EntityRecognizer.findEntity(args.entities, 'effect');

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
      controlLights(session, location.entity, lightState.entity, color && color.entity.replace(' ', ''));
    } else if (effect) {
      triggerLightEffect(session, effect.entity);
    } else {
      session.send(`I did not understand that light command. Please double check the available commands and retry.`);
      session.endDialog();
    }
  })
  .onDefault(session => {
    session.send("Sorry, I did not understand '%s'.", session.message.text);
    session.endDialog();
  });

bot.dialog('/', intents);

function triggerLightEffect(session, effect) {
  let pulseOptions = undefined;
  console.log(`Raw effect received: ${effect}`);
  let message = `Successfully initated "${effect}" effect`;
  let period = parseFloat(process.env.LifxEffectPeriod);
  let cycles = parseFloat(process.env.LifxEffectCycles);

  if (effect === 'cop mode') {
    pulseOptions = {
      color: 'blue',
      from_color: 'red',
      period: period,
      cycles: cycles,
      power_on: true
    };
  } else if (effect === 'new follower') {
    pulseOptions = {
      color: 'purple',
      from_color: 'white',
      period: period,
      cycles: cycles,
      power_on: true
    };
  } else if (effect === 'new subscriber') {
    pulseOptions = {
      color: 'green',
      from_color: 'purple',
      period: period,
      cycles: cycles,
      power_on: true
    };
  } else {
    // Not a defined effect so do nothing
    let warningMessage = `Received an unsupported effect: ${effect}`;
    console.warn(warningMessage);
    console.warn(`Full message received: ${message}`);

    session.send(warningMessage);
    session.endDialog();
  }

  if (pulseOptions) {
    console.log('Initiating the effect');
    client
      .pulse(lifxDeviceToUse, pulseOptions)
      .then(result => {
        session.send(message);
        session.endDialog();
      })
      .catch(error => {
        console.error(error);
        session.send(`There was an error initiating the effect: ${error}`);
        session.endDialog();
      });

    // setEffectOnHueLights(pulseOptions);
  } else {
    console.log('Options was undefined and therefore no effect was initiated');
  }
}

function controlLights(session, location, lightState, color) {
  let message = `The ${location} was turned ${lightState}`;
  console.log(color);
  let stateToSet = {
    power: `${lightState}`,
    brightness: 1.0,
    duration: 1
  };
  if (color) {
    stateToSet.color = `${color}`;
    message += ` and was set to ${color}`;
    // setHueLights(color);
  }
  setLifxLights(stateToSet, message, session);
}

function setLifxLights(stateToSet, message, session) {
  client
    .setState('label:Bottom Bulb', stateToSet)
    .then(result => {
      session.send(message);
      session.endDialog();
    })
    .catch(error => {
      console.error(error);
      session.send(`There was an error initiating the effect: ${error}`);
      session.endDialog();
    });
}

function setHueLights(color) {
  if (!hueEnabled) return;
  const colorUrl = `https://maker.ifttt.com/trigger/office-color/with/key/${iftttKey}`;
  const dimUrl = `https://maker.ifttt.com/trigger/office-dim/with/key/${iftttKey}`;
  const dimPayload = { value1: 100 };
  const colorPayload = { value1: color };
  sendHueCommand(colorUrl, colorPayload, dimUrl, dimPayload);
}

function sendHueCommand(colorUrl, colorPayload, dimUrl, dimPayload) {
  axios
    .post(colorUrl, colorPayload)
    .then(colorResult => {
      axios
        .post(dimUrl, dimPayload)
        .then(dimResult => {
          console.log('Finished setting Hue lights via IFTTT');
        })
        .catch(error => {
          console.error(`Failed to set DIM level on Hue lights: ${error}`);
        });
    })
    .catch(error => {
      console.error(`Failed to set COLOR on Hue lights: ${error}`);
    });
}

function setEffectOnHueLights(pulseOptions) {
  if (!hueEnabled) return;
  for (var i = 0; i < pulseOptions.cycles; i++) {
    let color = (i + 1) % 2 === 0 ? pulseOptions.from_color : pulseOptions.color;
    setHueLights(color);
    sleep(pulseOptions.period * 1000);
  }
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

module.exports = connector.listen();
