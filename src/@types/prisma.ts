export interface IPrismaSession {
  id: string; //record id
  sid: string; //session id (which can be configured to be same as record id, using dbRecordIdIsSessionId option)
  uid?: string | null; //Optional user id / name
  // * Non-unique; a given user may have multiple sessions - for multiple browsers, devices, etc.
  // * Auto-populated by set(), if the session argument passed to set() includes a uid property.
  // * Required to delete all sessions for a given user via destroyUsersSessions().
  // * Enables functions within this package, such as destroyUsersSessions(), to make user-based queries.
  data: string | null;
  expiresAt: Date;
}

export interface ICreatePrismaSession extends IPrismaSession {
  data: string;
}

interface IFindUniqueArgs {
  select?: {
    expiresAt?: boolean;
    sid?: boolean;
  };
  where: {
    sid: string;
  };
}

interface IFindManyArgs {
  select?: {
    data?: boolean;
    expiresAt?: boolean;
    sid?: boolean;
  };
  where?: {
    sid?: string;
    uid?: string;
  };
}

interface ICreateArgs {
  data: ICreatePrismaSession;
  uid?: string | null;
}

interface IUpdateArgs {
  data: Partial<ICreatePrismaSession>;
  uid?: string | null;
  where: { sid: string };
}

interface IDeleteArgs {
  where: { sid: string };
}

export type IPrisma<M extends string = 'session'> = Record<
  Exclude<M, `$${string}`>,
  {
    create(args: ICreateArgs): Promise<IPrismaSession>;
    delete(args: IDeleteArgs): Promise<IPrismaSession>;
    deleteMany(args?: unknown): Promise<unknown>;
    findMany(args?: IFindManyArgs): Promise<IPrismaSession[]>;
    findUnique(args: IFindUniqueArgs): Promise<IPrismaSession | null>;
    update(args: IUpdateArgs): Promise<IPrismaSession>;
  }
> & {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};
