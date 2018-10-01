module.exports = {
  LIFX_DEVICE_TO_USE: 'label:Bottom Bulb',
  INTENT_GREETING: 'Greeting',
  INTENT_HELP: 'Help',
  INTENT_LIGHTS: 'Lights',
  INTENT_CANCEL: 'Cancel',
  MESSAGE_GREETING: 'Sup, yo!',
  MESSAGE_HELP:
    'I can control the lights in your house. You can say things like, "Turn the kitchen lights on".',
  MESSAGE_CANCEL: 'OK. Canceled.',
  MESSAGE_LIGHTS_ACKNOWLEDGE: 'OK! One sec...',
  ENTITY_LIGHT_NAME: 'light',
  ENTITY_COLOR_NAME: 'color',
  ENTITY_EFFECT_NAME: 'effect',
  ENTITY_STATE_NAME: 'state',
  MESSAGE_COMMAND_NOT_UNDERSTOOD:
    'I did not understand that light command. Please double check the available commands and retry.',
  PULSE_EFFECT_OPTIONS_COP_MODE: {
    color: 'blue',
    from_color: 'red',
    period,
    cycles,
    power_on: true
  },
  PULSE_EFFECT_OPTIONS_NEW_FOLLOWER: {
    color: 'purple',
    from_color: 'white',
    period,
    cycles,
    power_on: true
  },
  PULSE_EFFECT_OPTIONS_NEW_SUBSCRIBER: {
    color: 'green',
    from_color: 'purple',
    period,
    cycles,
    power_on: true
  }
};
