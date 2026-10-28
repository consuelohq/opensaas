import { rollbackRailwayDeployment } from '../src/release/production-release.js';

const projectToken = process.env.RAILWAY_TOKEN?.trim();
const deploymentId = process.argv[2]?.trim();
if (!projectToken) throw new Error('RAILWAY_TOKEN is required');
if (!deploymentId) throw new Error('Railway deployment ID is required');
const result = await rollbackRailwayDeployment({ projectToken, deploymentId });
process.stdout.write(`${JSON.stringify(result)}\n`);
