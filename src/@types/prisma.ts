export interface IPrismaSession {
  id: string;
  sid: string;
  data: string | null;
  expires: Date;
}

interface ICreatePrismaSession extends IPrismaSession {
  data: string;
}

interface IFindOneArgs {
  where: {
    sid: string;
  };
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
}

interface IFindManyArgs {
  where?: {
    sid?: string;
  };
  select?: {
    expires?: boolean;
    sid?: boolean;
  };
}

interface ICreateArgs {
  data: ICreatePrismaSession;
}

interface IUpdateArgs {
  where: { sid: string };
  data: Partial<ICreatePrismaSession>;
}

interface IDeleteArgs {
  where: { sid: string };
}

export interface IPrisma {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  session: {
    findOne(args: IFindOneArgs): Promise<IPrismaSession | null>;
    findMany(args?: IFindManyArgs): Promise<IPrismaSession[]>;
    delete(args?: IDeleteArgs): Promise<IPrismaSession>;
    deleteMany(args?: any): Promise<any>;
    create(args: ICreateArgs): Promise<IPrismaSession>;
    update(args: IUpdateArgs): Promise<IPrismaSession>;
  };
}
