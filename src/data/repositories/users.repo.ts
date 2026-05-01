import type { User, ID, Role } from '@/domain/types';

export interface UsersRepository {
  getAll(): Promise<User[]>;
  getById(id: ID): Promise<User | null>;
  getByRole(role: Role): Promise<User[]>;
  create(user: User): Promise<User>;
  update(id: ID, patch: Partial<User>): Promise<User>;
  delete(id: ID): Promise<void>;
}
