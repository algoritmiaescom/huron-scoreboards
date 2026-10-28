const quoteArgument = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const createCommands = (files, commands) => {
  if (files.length === 0) {
    return [];
  }

  const argumentsList = files.map(quoteArgument).join(' ');
  return commands.map((command) => `${command} ${argumentsList}`);
};

export default {
  '*.{js,jsx,ts,tsx}': (files) =>
    createCommands(files, ['eslint --fix --max-warnings 0', 'prettier --write']),
  '*.{css,html,json,md,yaml,yml}': (files) => createCommands(files, ['prettier --write']),
};
