import type { TemplateFile, DeployConfig } from './types.js';

export const awsTemplates = (config: DeployConfig): TemplateFile[] => {
  const template = `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Consuelo API — serverless deployment

Parameters:
  DatabaseName:
    Type: String
    Default: consuelo
  DatabaseUsername:
    Type: String
    Default: admin
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
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: false

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: false

  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.0.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true

  NatGatewayEIP:
    Type: AWS::EC2::EIP
    DependsOn: AttachGateway
    Properties:
      Domain: vpc

  NatGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGatewayEIP.AllocationId
      SubnetId: !Ref PublicSubnet

  PrivateRouteTable1:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PrivateRoute1:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet1
      RouteTableId: !Ref PrivateRouteTable1

  PrivateRouteTable2:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PrivateRoute2:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet2
      RouteTableId: !Ref PrivateRouteTable2

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PublicRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref PublicRouteTable

  LambdaSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Lambda
      VpcId: !Ref VPC
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0

  RDSSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for RDS
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref LambdaSecurityGroup

  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS
      Subnets:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  DatabaseSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "consuelo/db-secret/\${AWS::StackName}"
      GenerateSecretString:
        SecretStringTemplate: !Sub '{"username": "\${DatabaseUsername}"}'
        GenerateStringKey: password
        PasswordLength: 16
        ExcludeCharacters: '"@/\\'

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub "consuelo-db-\${AWS::StackName}"
      DBName: !Ref DatabaseName
      Engine: postgres
      EngineVersion: '16'
      DBInstanceClass: db.t3.micro
      AllocatedStorage: 20
      StorageType: gp3
      StorageEncrypted: true
      MasterUsername: !Join ['', ['{{resolve:secretsmanager:', !Ref DatabaseSecret, ':SecretString:username}}']]
      MasterUserPassword: !Join ['', ['{{resolve:secretsmanager:', !Ref DatabaseSecret, ':SecretString:password}}']]
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref RDSSecurityGroup
      EnableIAMDatabaseAuthentication: true
      PubliclyAccessible: false
      BackupRetentionPeriod: 7
      DeletionProtection: false
    DeletionPolicy: Retain

  ConsueloApi:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.handler
      CodeUri: .
      Policies:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
        - Statement:
            - Effect: Allow
              Action: secretsmanager:GetSecretValue
              Resource: !Ref DatabaseSecret
      VpcConfig:
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
        SecurityGroupIds:
          - !Ref LambdaSecurityGroup
      Environment:
        Variables:
          NODE_ENV: production
          DB_SECRET_ARN: !Ref DatabaseSecret
          DB_HOST: !GetAtt Database.Endpoint.Address
          DB_PORT: !GetAtt Database.Endpoint.Port
          DB_NAME: !Ref DatabaseName
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
  DatabaseEndpoint:
    Description: RDS Database Endpoint
    Value: !GetAtt Database.Endpoint.Address
  DatabasePort:
    Description: RDS Database Port
    Value: !GetAtt Database.Endpoint.Port
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
};
