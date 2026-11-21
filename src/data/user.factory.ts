import type { APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export interface TestUser { id: string; email: string; displayName: string }

/** Synthetic, unique-per-worker users created through the API and removed after the test. */
export class UserFactory {
  private readonly created: string[] = [];
  constructor(private readonly request: APIRequestContext, private readonly workerIndex: number) {}

  build(overrides: Partial<TestUser> = {}): TestUser {
    const suffix = `${this.workerIndex}-${randomUUID().slice(0, 8)}`;
    return { id: '', email: `qa+${suffix}@example.test`, displayName: `QA User ${suffix}`, ...overrides };
  }

  async create(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const user = this.build(overrides);
    const res = await this.request.post('/api/test-users', { data: user });
    if (!res.ok()) throw new Error(`creating a test user failed: HTTP ${res.status()}`);
    const saved = (await res.json()) as TestUser;
    this.created.push(saved.id);
    return saved;
  }

  async cleanup(): Promise<void> {
    for (const id of this.created.splice(0)) await this.request.delete(`/api/test-users/${id}`);
  }
}
