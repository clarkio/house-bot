var builder = require('botbuilder');
require('dotenv').config();
var botbuilder_azure = require('botbuilder-azure');
var lifx = require('lifx-http-api'),
  client;

client = new lifx({
  bearerToken: process.env['LifxApiKey']
});

var connector = new botbuilder_azure.BotServiceConnector({
  appId: process.env['MicrosoftAppId'],
  appPassword: process.env['MicrosoftAppPassword']
});

var bot = new builder.UniversalBot(connector, {
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
    // !bulb trigger club mode
    // !bulb trigger breathe effect red blue 1 10

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
    }

    // got both location and light state, move on to the next step
    if (location && lightState) {
      // we call LIFX
      // color.entity.replace is for handling hex color codes since LUIS separate #, numbers
      controlLights(session, location.entity, lightState.entity, color && color.entity.replace(' ', ''));
    } else if (effect) {
      triggerLightEffect(session, effect.entity);
    } else {
      session.send(`I did not understand that light command. Please double check the available commands and retry.`);
    }
  })
  .onDefault(session => {
    session.send("Sorry, I did not understand '%s'.", session.message.text);
  });

bot.dialog('/', intents);

function triggerLightEffect(session, effect) {
  console.log(`Effect received: ${effect}`);
  let pulseOptions = {};
  let cycleOptions = {};

  if (effect === 'club mode') {
    cycleOptions = {
      states: [
        { brightness: 1.0, duration: 0.5, color: 'red saturation:1.0' },
        { brightness: 1.0, duration: 0.5, color: 'blue saturation:1.0' },
        { brightness: 1.0, duration: 0.5, color: 'purple saturation:1.0' },
        { brightness: 1.0, duration: 0.5, color: 'green saturation:1.0' },
        { brightness: 1.0, duration: 0.5, color: 'orange saturation:1.0' }
      ],
      defaults: { power: 'on', duration: 0.5 }
    };
    client
      .cycle('label:Bottom Bulb', cycleOptions)
      .then(result => {
        session.send(message);
        session.endDialog();
      })
      .catch(error => console.error(error));
  } else if (effect === 'cop mode') {
    console.log('Made it to cop mode!');
    pulseOptions = {
      color: 'blue',
      from_color: 'red',
      period: 0.5,
      cycles: 10,
      power_on: true
    };
    client
      .pulse('label:Bottom Bulb', pulseOptions)
      .then(result => {
        session.send(message);
        session.endDialog();
      })
      .catch(error => console.error(error));
  } else {
    // do nothing
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
    stateToSet.color = `${color} saturation:1.0`;
    message += ` and was set to ${color}`;
  }
  client
    .setState('label:Bottom Bulb', stateToSet)
    .then(result => {
      session.send(message);
      session.endDialog();
    })
    .catch(console.error);
}

module.exports = connector.listen();
