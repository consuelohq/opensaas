import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { toolPackage } from '../tools/linear/manifest';

const root = join(import.meta.dirname, '..', '..', '..');
const script = join(root, 'packages', 'os', 'scripts', 'linear.js');
const tempDirs: string[] = [];
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const TRIAGE = '44444444-4444-4444-8444-444444444444';
const OPEN = '55555555-5555-4555-8555-555555555555';
const CANCELED = '66666666-6666-4666-8666-666666666666';
const TEAM = '29f5c661-da6c-4bfb-bd48-815a006ccaac';

function run(args: string[], overrides: Record<string,string> = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'linear-regression-'));
  tempDirs.push(temp);
  const home = join(temp, 'home');
  const auth = join(home, 'Dev', 'opensaas', '.agent');
  mkdirSync(auth, { recursive: true });
  writeFileSync(join(auth, '.chatgpt-token.json'), JSON.stringify({access_token:'local-mock-only'}));
  const requests = join(temp, 'requests.jsonl');
  const preload = join(temp, 'mock-fetch.cjs');
  const fixture = {A, B, PROJECT, TRIAGE, OPEN, CANCELED, TEAM};
  const prelude = [
    'const { appendFileSync } = require("node:fs");',
    'const f = ' + JSON.stringify(fixture) + ';',
    'globalThis.fetch = async (_url, options) => {',
    '  const r = JSON.parse(options.body);',
    '  appendFileSync(process.env.LINEAR_CAPTURE, JSON.stringify(r) + "\\n");',
    '  const q=r.query; const v=r.variables || {};',
    '  const rel = {id:f.B,type:"related",issue:{id:f.A,identifier:"DEV-1"},relatedIssue:{id:f.B,identifier:"DEV-2"}};',
    '  const issue = id => ({id: id === "DEV-2" ? f.B : f.A, identifier:id, team:{id:f.TEAM}, state:{id:f.TRIAGE,name:"Triage",type:process.env.LINEAR_NOT_TRIAGE === "1" ? "unstarted" : "triage"}, relations:{nodes:process.env.LINEAR_EXISTING_RELATION === "1" && id === "DEV-1" ? [rel] : [],pageInfo:{hasNextPage:process.env.LINEAR_TRUNCATED_RELATIONS === "1"}}, inverseRelations:{nodes:[],pageInfo:{hasNextPage:false}}});',
    '  let data={};',
    '  if(q.includes("issueLabels(")) data={issueLabels:{nodes:[{id:f.A,name:"[test]"},{id:f.B,name:"improvement"}]}};',
    '  else if(q.includes("projects(")) data={projects:{nodes:[{id:f.PROJECT,name:"OS",teams:{nodes:[{id:f.TEAM}]}}],pageInfo:{hasNextPage:false}}};',
    '  else if(q.includes("team(id:")) data={team:{id:f.A,states:{nodes:[{id:f.TRIAGE,name:"Triage",type:"triage"},{id:f.OPEN,name:"open",type:"unstarted"},{id:f.CANCELED,name:"Canceled",type:"canceled"}]}}};',
    '  else if(q.includes("viewer")) data={viewer:{id:f.A,name:"chatgpt"}};',
    '  else if(q.includes("commentCreate")) data={commentCreate:{success:true,comment:{id:f.B,body:v.input.body,user:{id:f.A,name:"chatgpt"},createdAt:"2026-10-31T00:00:00Z"}}};',
    '  else if(q.includes("issueRelationCreate")) data={issueRelationCreate:{success:true,issueRelation:{id:f.B,type:v.input.type}}};',
    '  else if(q.includes("issueRelationDelete")) data={issueRelationDelete:{success:true}};',
    '  else if(q.includes("issueUpdate")) data={issueUpdate:{success:true,issue:{id:f.A,identifier:"DEV-1",state:{name:v.input.stateId},labels:{nodes:[]}}}};',
    '  else if(q.includes("issueCreate")) data={issueCreate:{success:true,issue:{id:f.A,identifier:"DEV-1",state:{name:"Triage"},labels:{nodes:[]}}}};',
    '  else if(q.includes("issue(")) data={issue:issue(v.id)};',
    '  return new Response(JSON.stringify({data}),{status:200,headers:{"content-type":"application/json"}});',
    '};',
  ].join('\n');
  writeFileSync(preload, prelude);
  const result = spawnSync('bun', ['--preload', preload, script, ...args], {
    cwd:root, env:{...process.env,HOME:home,LINEAR_CAPTURE:requests,...overrides},encoding:'utf8',
  });
  const calls = (() => { try { return readFileSync(requests,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)); } catch { return []; } })();
  return {result,calls};
}
afterEach(()=>{for(const dir of tempDirs.splice(0))rmSync(dir,{recursive:true,force:true});});

describe('Linear CLI and typed tool contract',()=>{
  it('preserves multiple labels supplied as repeated facade flags',()=>{
    const {result,calls}=run(['update','DEV-1','--labels','[test]','--labels','improvement']);
    expect(result.status).toBe(0);
    expect(calls.find(c=>c.query.includes('issueUpdate')).variables.input.labelIds).toEqual([A,B]);
  });
  it('creates without absent default labels or forced state',()=>{
    const {result,calls}=run(['create','Test new intake']);
    expect(result.status).toBe(0);
    const input=calls.find(c=>c.query.includes('issueCreate')).variables.input;
    expect(input).not.toHaveProperty('labelIds');
    expect(input).not.toHaveProperty('stateId');
  });
  it('resolves a named project and named triage state',()=>{
    const {result,calls}=run(['create','Project smoke','--project','OS','--state','Triage']);
    expect(result.status).toBe(0);
    expect(calls.find(c=>c.query.includes('issueCreate')).variables.input).toMatchObject({projectId:PROJECT,stateId:TRIAGE});
  });
  it('exposes typed authenticated comments with author verification',()=>{
    expect(toolPackage.definitions.map(x=>x.name)).toEqual(expect.arrayContaining(['linear.createComment','linear.comments']));
    const {result}=run(['comment','DEV-1','hello']);
    expect(result.status).toBe(0);
    const output=JSON.parse(result.stdout);
    expect(output.comment.user.name).toBe('chatgpt');
    expect(output.authenticatedAs.name).toBe('chatgpt');
    expect(output.authorVerified).toBe(true);
  });
  it('exposes typed native issue relations',()=>{
    expect(toolPackage.definitions.map(x=>x.name)).toEqual(expect.arrayContaining(['linear.relations','linear.createRelation','linear.deleteRelation']));
    const {result,calls}=run(['relation-create','DEV-1','DEV-2','--type','blocks']);
    expect(result.status).toBe(0);
    expect(calls.find(c=>c.query.includes('issueRelationCreate')).variables.input).toEqual({issueId:A,relatedIssueId:B,type:'blocks'});
  });
  it('does not replace a native related link when a caller requests a different dependency type',()=>{
    const {result,calls}=run(['relation-create','DEV-1','DEV-2','--type','blocks'],{LINEAR_EXISTING_RELATION:'1'});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/existing|replace/i);
    expect(calls.some(c=>c.query.includes('issueRelationCreate'))).toBe(false);
  });
  it('treats the exact existing relation as idempotent rather than duplicating it',()=>{
    const {result,calls}=run(['relation-create','DEV-1','DEV-2','--type','related'],{LINEAR_EXISTING_RELATION:'1'});
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).alreadyExists).toBe(true);
    expect(calls.some(c=>c.query.includes('issueRelationCreate'))).toBe(false);
  });
  it('fails closed on incomplete issue relation pagination',()=>{
    const {result,calls}=run(['relation-create','DEV-1','DEV-2','--type','blocks'],{LINEAR_TRUNCATED_RELATIONS:'1'});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/incomplete/);
    expect(calls.some(c=>c.query.includes('issueRelationCreate'))).toBe(false);
  });
  it('exposes a typed triage action with dynamically resolved team state',()=>{
    expect(toolPackage.definitions.map(x=>x.name)).toContain('linear.triageIssue');
    const {result,calls}=run(['triage','DEV-1','--action','accept']);
    expect(result.status).toBe(0);
    expect(calls.find(c=>c.query.includes('issueUpdate')).variables.input.stateId).toBe(OPEN);
  });
  it('prevents accept/decline transitions outside Triage',()=>{
    const {result,calls}=run(['triage','DEV-1','--action','decline'],{LINEAR_NOT_TRIAGE:'1'});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Triage/);
    expect(calls.some(c=>c.query.includes('issueUpdate'))).toBe(false);
  });
  it('does not silently accept an unsupported workflow state',()=>{
    const {result,calls}=run(['create','Unknown state','--state','invented']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unknown or ambiguous/);
    expect(calls.some(c=>c.query.includes('issueCreate'))).toBe(false);
  });
});
