const Settings = {
  alternateRolls:"alternateRolls",
};

export const registerSystemSettings = () => {
    game.settings.register(CONFIG.Vaarn.systemName, Settings.alternateRolls, {
    name: "Use Alternate Rolls",
    hint: "When selected, PCs will roll 2d10 for rolls, instead of 1d20.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    });
};


const getSetting = (setting) => {
    console.log(CONFIG.Vaarn.systemName, setting)
  return game.settings.get(CONFIG.Vaarn.systemName, setting);
};

const setSetting = (setting, value) => {
  return game.settings.set(CONFIG.Vaarn.systemName, setting, value);
};

export const alternateRolls = () => {
  return getSetting(Settings.alternateRolls);
};