export interface TemplateFile {
  path: string;
  content: string;
}

export interface DeployConfig {
  twentyEnabled: boolean;
  apiPort: number;
  serverPort: number;
}
