module.exports = {
  LIFX_DEVICE_TO_USE: 'label:Bottom Bulb',
  intents: {
    GREETING: 'Greeting',
    HELP: 'Help',
    LIGHTS: 'Lights',
    CANCEL: 'Cancel'
  },
  messages: {
    GREETING: 'Sup, yo!',
    HELP:
      'I can control the lights in your house. You can say things like, "Turn the kitchen lights on".',
    CANCEL: 'OK. Canceled.',
    LIGHTS_ACKNOWLEDGE: 'OK! One sec...',
    LIGHT_COMMAND_NOT_UNDERSTOOD:
      'I did not understand that light command. Please double check the available commands and retry.'
  },
  entities: {
    LIGHT_NAME: 'light',
    COLOR_NAME: 'color',
    EFFECT_NAME: 'effect',
    STATE_NAME: 'state'
  },
  PULSE_EFFECT_OPTIONS_COP_MODE: {
    color: 'blue',
    from_color: 'red',
    power_on: true
  },
  PULSE_EFFECT_OPTIONS_NEW_FOLLOWER: {
    color: 'purple',
    from_color: 'white',
    power_on: true
  },
  PULSE_EFFECT_OPTIONS_NEW_SUBSCRIBER: {
    color: 'green',
    from_color: 'purple',
    power_on: true
  },
  EFFECT_COP_MODE: 'cop mode',
  EFFECT_NEW_FOLLOWER: 'new follower',
  EFFECT_NEW_SUBSCRIBER: 'new subscriber',
  logs: {
    FULL_MESSAGE_RECEIVED: logFullMessageReceivedTag,
    UNSUPPORTED_EFFECT: logUnsupportedEffect,
    EFFECT_TRIGGERED: logEffectTriggered,
    MESSAGE_NOT_UNDERSTOOD: logMessageNotUnderstood,
    INITIATING_EFFECT: 'Initiating the effect'
  }
};

function logMessageNotUnderstood(messageText) {
  return `Sorry, I did not understand ${messageText}.`;
}

function logEffectTriggered(effect) {
  return `The effect triggered was: ${effect}`;
}

function logFullMessageReceivedTag(message) {
  return `Full message received: ${message}`;
}

function logUnsupportedEffect(effect) {
  return `Received an unsupported effect: ${effect}`;
}
