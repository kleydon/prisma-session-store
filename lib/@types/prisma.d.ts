export interface PrismaSession {
  id: string;
  sid: string;
  data: string | null;
  expires: Date;
}

interface CreatePrismaSession extends PrismaSession {
  data: string;
}

interface FindOneArgs {
  where: {
    sid: string;
  };
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
}

interface FindManyArgs {
  where?: {
    sid?: string;
  };
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
}

interface CreateArgs {
  data: CreatePrismaSession;
}

interface UpdateArgs {
  where: { sid: string };
  data: Partial<CreatePrismaSession>;
}

interface DeleteArgs {
  where: { sid: string };
}

export interface Prisma {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  session: {
    findOne(args: FindOneArgs): Promise<PrismaSession | null>;
    findMany(args?: FindManyArgs): Promise<PrismaSession[]>;
    delete(args?: DeleteArgs): Promise<PrismaSession>;
    deleteMany(args?: any): Promise<any>;
    create(args: CreateArgs): Promise<PrismaSession>;
    update(args: UpdateArgs): Promise<PrismaSession>;
  };
}
