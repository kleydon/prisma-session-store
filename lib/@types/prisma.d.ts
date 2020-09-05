export interface PrismaSession {
  id: string;
  sid: string;
  data: string;
  expires: Date;
}

interface FindArgs {
  where?: {
    sid?: string;
  };
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
}

interface CreateArgs {
  data: PrismaSession;
}

interface UpdateArgs {
  where: { sid: string };
  data: Partial<PrismaSession>;
}

interface DeleteArgs {
  where: { sid: string };
}

export interface Prisma {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  session: {
    findOne(args?: FindArgs): Promise<PrismaSession>;
    findMany(args?: FindArgs): Promise<PrismaSession[]>;
    delete(args?: DeleteArgs): Promise<PrismaSession>;
    create(args?: CreateArgs): Promise<PrismaSession>;
    update(args?: UpdateArgs): Promise<PrismaSession>;
  };
}
