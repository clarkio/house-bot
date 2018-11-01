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
    LIGHT_KEY: 'light',
    COLOR_KEY: 'color',
    COLOR_REGEX_KEY: 'colorRegex',
    EFFECT_TYPE_KEY: 'effectType',
    EFFECT_STATE_KEY: 'effectState',
    EFFECT_NAME_KEY: 'effectName',
    STATE_KEY: 'state'
  },
  lifxPulseEffectOptions: {
    COP_MODE: {
      color: 'blue',
      from_color: 'red',
      power_on: true
    },
    NEW_FOLLOWER: {
      color: 'purple',
      from_color: 'white',
      power_on: true
    },
    NEW_SUBSCRIBER: {
      color: 'green',
      from_color: 'purple',
      power_on: true
    }
  },
  lifxCycleEffectDefaults: {
    power: 'on',
    duration: 5,
    hue: 60,
    saturation: 1
  },
  effects: {
    COP_MODE: 'cop mode',
    NEW_FOLLOWER: 'new follower',
    NEW_SUBSCRIBER: 'new subscriber'
  },
  effectTypes: {
    PULSE: 'pulse',
    CYCLE: 'cycle'
  },
  logs: {
    FULL_MESSAGE_RECEIVED: logFullMessageReceivedTag,
    UNSUPPORTED_EFFECT: logUnsupportedEffect,
    EFFECT_TRIGGERED: logEffectTriggered,
    MESSAGE_NOT_UNDERSTOOD: logMessageNotUnderstood,
    INITIATING_EFFECT: 'Initiating the effect...',
    INITIATING_PULSE_EFFECT: 'Initiating a pulse effect...',
    INITIATING_CYCLE_EFFECT: 'Initiating a cycle effect...',
    RAW_EFFECT_RECEIVED: logRawEffectReceived,
    INITIATED_EFFECT: logInitiatedEffect,
    NO_EFFECT_INITIATED:
      'Options was undefined and therefore no effect was initiated'
  }
};

function logInitiatedEffect(effect) {
  return `Successfully initiated the "${effect}" effect`;
}

function logRawEffectReceived(effect) {
  return `Raw effect received: ${effect}`;
}

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
