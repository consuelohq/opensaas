import type { TemplateFile, DeployConfig } from './types.js';

export function awsTemplates(config: DeployConfig): TemplateFile[] {
  const template = `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Consuelo API — serverless deployment

Parameters:
  DatabaseUrl:
    Type: String
    NoEcho: true
  TwilioAccountSid:
    Type: String
    NoEcho: true
    Default: ''
  TwilioAuthToken:
    Type: String
    NoEcho: true
    Default: ''
  GroqApiKey:
    Type: String
    NoEcho: true
    Default: ''
  AppSecret:
    Type: String
    NoEcho: true

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs24.x
    MemorySize: 512

Resources:
  ConsueloApi:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.handler
      CodeUri: .
      Environment:
        Variables:
          NODE_ENV: production
          DATABASE_URL: !Ref DatabaseUrl
          TWILIO_ACCOUNT_SID: !Ref TwilioAccountSid
          TWILIO_AUTH_TOKEN: !Ref TwilioAuthToken
          GROQ_API_KEY: !Ref GroqApiKey
          APP_SECRET: !Ref AppSecret
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY

Outputs:
  ApiUrl:
    Description: API Gateway URL
    Value: !Sub 'https://\${ServerlessHttpApi}.execute-api.\${AWS::Region}.amazonaws.com'
`;

  const samconfig = `version = 0.1

[default.deploy.parameters]
stack_name = "consuelo"
resolve_s3 = true
s3_prefix = "consuelo"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
`;

  const handler = `// lambda entry point for consuelo api
import { createServer, proxy } from 'aws-serverless-express';
import { app } from './packages/api/dist/index.js';

const server = createServer(app);

export const handler = (event, context) => proxy(server, event, context);
`;

  return [
    { path: 'template.yaml', content: template },
    { path: 'samconfig.toml', content: samconfig },
    { path: 'lambda.js', content: handler },
  ];
}
