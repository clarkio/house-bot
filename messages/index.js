var builder = require('botbuilder');
require('dotenv').config();
var botbuilder_azure = require('botbuilder-azure');

console.log(process.env['MicrosoftAppId']);

var connector = new botbuilder_azure.BotServiceConnector({
  appId: process.env['MicrosoftAppId'],
  appPassword: process.env['MicrosoftAppPassword'],
  openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

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
    console.log(args);
    var location = builder.EntityRecognizer.findEntity(args.entities, 'light');

    var lightState = builder.EntityRecognizer.findEntity(args.entities, 'state');
    console.log('The location is: ', location);
    console.log('The state of the light is: ', lightState);

    // got both location and light state, move on to the next step
    if (location && lightState) {
      // we call LIFX
      controlLights(session, location.entity, lightState.entity);
    }

    // got a location, but no light state
    if (!location || !lightState) {
      session.send(
        `I need to know which light and if you want it on or off. You can say things like, "Turn on/off the light".`
      );
    }
  })
  .onDefault(session => {
    session.send("Sorry, I did not understand '%s'.", session.message.text);
  });

bot.dialog('/', intents);

function controlLights(session, location, lightState) {
  session.send(`${location} lights are ${lightState}`);
  session.endDialog();
}

module.exports = connector.listen();
