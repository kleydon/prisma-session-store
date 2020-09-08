export interface IPrismaSession {
  data: string | null;
  expires: Date;
  id: string;
  sid: string;
}

interface ICreatePrismaSession extends IPrismaSession {
  data: string;
}

interface IFindOneArgs {
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
  where: {
    sid: string;
  };
}

interface IFindManyArgs {
  select?: {
    data?: boolean;
    expires?: boolean;
    sid?: boolean;
  };
  where?: {
    sid?: string;
  };
}

interface ICreateArgs {
  data: ICreatePrismaSession;
}

interface IUpdateArgs {
  data: Partial<ICreatePrismaSession>;
  where: { sid: string };
}

interface IDeleteArgs {
  where: { sid: string };
}

export interface IPrisma {
  session: {
    create(args: ICreateArgs): Promise<IPrismaSession>;
    delete(args: IDeleteArgs): Promise<IPrismaSession>;
    deleteMany(args: unknown): Promise<unknown>;
    findMany(args: IFindManyArgs): Promise<IPrismaSession[]>;
    findOne(args: IFindOneArgs): Promise<IPrismaSession | null>;
    update(args: IUpdateArgs): Promise<IPrismaSession>;
  };
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
