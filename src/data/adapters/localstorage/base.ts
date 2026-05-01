export class LocalStorageBase<T extends { id: string }> {
  private readonly key: string;
  constructor(key: string) { this.key = key; }

  private read(): T[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '[]') as T[];
    } catch {
      return [];
    }
  }

  private write(items: T[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  async getAll(): Promise<T[]> {
    return this.read();
  }

  async getById(id: string): Promise<T | null> {
    return this.read().find(item => item.id === id) ?? null;
  }

  async create(item: T): Promise<T> {
    const items = this.read();
    items.push(item);
    this.write(items);
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const items = this.read();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Item ${id} not found in ${this.key}`);
    items[idx] = { ...items[idx], ...patch };
    this.write(items);
    return items[idx];
  }

  async updateMany(updated: T[]): Promise<T[]> {
    const items = this.read();
    const map = new Map(updated.map(u => [u.id, u]));
    const merged = items.map(i => map.get(i.id) ?? i);
    // append any new ones not already in list
    for (const u of updated) {
      if (!items.find(i => i.id === u.id)) merged.push(u);
    }
    this.write(merged);
    return merged;
  }

  async delete(id: string): Promise<void> {
    this.write(this.read().filter(i => i.id !== id));
  }

  async createMany(newItems: T[]): Promise<T[]> {
    const items = this.read();
    items.push(...newItems);
    this.write(items);
    return newItems;
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
