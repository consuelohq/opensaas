import * as crypto from 'node:crypto';
import type {
  CronJob, Dashboard, Decision, PaginatedResponse, Project,
  QueryOptions, Research, WorkspaceStore
} from './index.js';

/** In-memory implementation of WorkspaceStore for dev/testing */
export class MemoryWorkspaceStore implements WorkspaceStore {
  private research = new Map<string, Research>();
  private cronJobs = new Map<string, CronJob>();
  private projects = new Map<string, Project>();
  private decisions = new Map<string, Decision>();
  private dashboards = new Map<string, Dashboard>();

  private paginate<T>(items: T[], opts?: QueryOptions): PaginatedResponse<T> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    return { data: items.slice(offset, offset + limit), meta: { total: items.length, limit, offset } };
  }

  // Research
  async createResearch(data: Omit<Research, 'id' | 'createdAt' | 'updatedAt'>): Promise<Research> {
    const now = new Date().toISOString();
    const r: Research = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.research.set(r.id, r);
    return r;
  }
  async getResearch(id: string) { return this.research.get(id) ?? null; }
  async listResearch(opts?: QueryOptions) {
    let items = [...this.research.values()];
    if (opts?.status) items = items.filter(r => r.status === opts.status);
    if (opts?.tag) items = items.filter(r => r.tags.includes(opts.tag!));
    if (opts?.search) items = items.filter(r => r.title.includes(opts.search!) || r.content.includes(opts.search!));
    return this.paginate(items, opts);
  }
  async updateResearch(id: string, data: Partial<Research>) {
    const r = this.research.get(id);
    if (!r) return null;
    const { id: _id, createdAt: _ca, ...rest } = data;
    Object.assign(r, rest, { updatedAt: new Date().toISOString() });
    return r;
  }
  async deleteResearch(id: string) { return this.research.delete(id); }

  // Cron Jobs
  async createCronJob(data: Omit<CronJob, 'id' | 'createdAt'>): Promise<CronJob> {
    const c: CronJob = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.cronJobs.set(c.id, c);
    return c;
  }
  async getCronJob(id: string) { return this.cronJobs.get(id) ?? null; }
  async listCronJobs(opts?: QueryOptions) { return this.paginate([...this.cronJobs.values()], opts); }
  async updateCronJob(id: string, data: Partial<CronJob>) {
    const c = this.cronJobs.get(id);
    if (!c) return null;
    const { id: _id, createdAt: _ca, ...rest } = data;
    Object.assign(c, rest);
    return c;
  }
  async deleteCronJob(id: string) { return this.cronJobs.delete(id); }

  // Projects
  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date().toISOString();
    const p: Project = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.projects.set(p.id, p);
    return p;
  }
  async getProject(id: string) { return this.projects.get(id) ?? null; }
  async listProjects(opts?: QueryOptions) {
    let items = [...this.projects.values()];
    if (opts?.status) items = items.filter(p => p.status === opts.status);
    return this.paginate(items, opts);
  }
  async updateProject(id: string, data: Partial<Project>) {
    const p = this.projects.get(id);
    if (!p) return null;
    const { id: _id, createdAt: _ca, ...rest } = data;
    Object.assign(p, rest, { updatedAt: new Date().toISOString() });
    return p;
  }
  async deleteProject(id: string) { return this.projects.delete(id); }

  // Decisions
  async createDecision(data: Omit<Decision, 'id' | 'createdAt'>): Promise<Decision> {
    const d: Decision = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.decisions.set(d.id, d);
    return d;
  }
  async getDecision(id: string) { return this.decisions.get(id) ?? null; }
  async listDecisions(opts?: QueryOptions) {
    let items = [...this.decisions.values()];
    if (opts?.tag) items = items.filter(d => d.tags.includes(opts.tag!));
    return this.paginate(items, opts);
  }
  async deleteDecision(id: string) { return this.decisions.delete(id); }

  // Dashboards
  async createDashboard(data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const now = new Date().toISOString();
    const d: Dashboard = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.dashboards.set(d.id, d);
    return d;
  }
  async getDashboard(id: string) { return this.dashboards.get(id) ?? null; }
  async listDashboards(opts?: QueryOptions) { return this.paginate([...this.dashboards.values()], opts); }
  async updateDashboard(id: string, data: Partial<Dashboard>) {
    const d = this.dashboards.get(id);
    if (!d) return null;
    const { id: _id, createdAt: _ca, ...rest } = data;
    Object.assign(d, rest, { updatedAt: new Date().toISOString() });
    return d;
  }
  async deleteDashboard(id: string) { return this.dashboards.delete(id); }
}
