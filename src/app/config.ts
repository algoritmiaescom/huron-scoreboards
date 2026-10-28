export const appConfig = {
  repository: {
    url: 'https://github.com/OWNER/REPOSITORY',
    branch: 'main',
    isPlaceholder: true,
  },
};

export const repositoryLinks = {
  home: appConfig.repository.url,
  data: `${appConfig.repository.url}/tree/${appConfig.repository.branch}/data`,
  contributing: `${appConfig.repository.url}/blob/${appConfig.repository.branch}/CONTRIBUTING.md`,
  dataModel: `${appConfig.repository.url}/blob/${appConfig.repository.branch}/docs/data-model.md`,
  pullRequests: `${appConfig.repository.url}/pulls`,
};
