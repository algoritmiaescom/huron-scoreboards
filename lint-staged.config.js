import path from 'node:path';

const quoteArgument = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const excludePrototype = (files) => {
  const prototypeRoot = `${path.resolve('prototype')}${path.sep}`;
  return files.filter((file) => !path.resolve(file).startsWith(prototypeRoot));
};

const createCommands = (files, commands) => {
  const includedFiles = excludePrototype(files);

  if (includedFiles.length === 0) {
    return [];
  }

  const argumentsList = includedFiles.map(quoteArgument).join(' ');
  return commands.map((command) => `${command} ${argumentsList}`);
};

export default {
  '*.{js,jsx,ts,tsx}': (files) =>
    createCommands(files, ['eslint --fix --max-warnings 0', 'prettier --write']),
  '*.{css,html,json,md,yaml,yml}': (files) => createCommands(files, ['prettier --write']),
};
