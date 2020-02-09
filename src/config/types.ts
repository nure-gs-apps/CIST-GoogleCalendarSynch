export interface IFullAppConfig {
  // Keep the key in common camel case or environment config will break
  ncgc: {
    configDir?: string;
  }
}