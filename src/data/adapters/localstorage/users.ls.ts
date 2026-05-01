import type { User, ID, Role } from '@/domain/types';
import type { UsersRepository } from '@/data/repositories/users.repo';
import { LocalStorageBase } from './base';

export class UsersLocalStorage extends LocalStorageBase<User> implements UsersRepository {
  constructor() { super('tr:users'); }

  async getById(id: ID): Promise<User | null> {
    return super.getById(id);
  }

  async getByRole(role: Role): Promise<User[]> {
    return (await this.getAll()).filter(u => u.role === role);
  }
}
