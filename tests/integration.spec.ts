// tslint:disable: no-duplicate-string
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../prisma/generated/client';
import { execSync } from 'child_process';
import express from 'express';
import session from 'express-session';
import { existsSync } from 'fs';
import { join } from 'path';
import request from 'supertest';

import { PrismaSessionStore } from '../src';

declare module 'express-session' {
  // tslint:disable-next-line: naming-convention
  interface SessionData {
    data?: string;
  }
}

describe('integration testing', () => {
  const app = express();
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaBetterSqlite3({ url: connectionString });
  const prisma = new PrismaClient({ adapter });

  beforeAll(() => {
    if (!existsSync(join(__dirname, '../prisma/dev.db')))
      execSync('prisma migrate dev --name init --preview-feature');

    app.use(
      session({
        secret: 'something',
        resave: false,
        saveUninitialized: false,
        store: new PrismaSessionStore(prisma, {
          logger: false,
          sessionModelName: 'otherSession',
        }),
      })
    );

    app.get('/', (req, res) => {
      res.json(req.session?.data);
    });

    app.post('/', (req, res) => {
      req.session.data = 'TESTING';
      res.json(req.session?.data);
    });

    app.put('/', (req, res) => {
      req.session.data = 'UPDATED';
      res.json(req.session?.data);
    });

    app.delete('/', (req, res) => {
      req.session.destroy(() => {
        res.json(req.session?.data);
      });
    });
  });

  afterAll(() => {
    prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.otherSession.deleteMany({});
  });

  it('should not initialize a user session when the session is not modified', async () => {
    await request(app)
      .get('/')
      .expect(async ({ headers }) => {
        const sessions = await prisma.otherSession.findMany();
        expect(sessions).toHaveLength(0);
        expect(headers).not.toHaveProperty('set-cookie');
      });
  });

  it('should initialize a user session when session is modified', async () => {
    await request(app)
      .post('/')
      .expect(async ({ headers }) => {
        const sessions = await prisma.otherSession.findMany();
        expect(sessions).toHaveLength(1);
        expect(headers).toHaveProperty('set-cookie');
      });
  });

  it('should delete the session from prisma', async () => {
    const [sessionCookie] = await request(app)
      .post('/')
      .then(async ({ headers }) => headers['set-cookie']);

    await request(app)
      .delete('/')
      .set('Cookie', sessionCookie)
      .expect(async () => {
        const sessions = await prisma.otherSession.findMany();
        expect(sessions).toHaveLength(0);
      });
  });

  it('should update the session in prisma', async () => {
    const [sessionCookie] = await request(app)
      .post('/')
      .then(async ({ headers }) => headers['set-cookie']);

    const [newSession] = await prisma.otherSession.findMany();
    expect(JSON.parse(newSession.data!)).toStrictEqual(
      expect.objectContaining({
        data: 'TESTING',
      })
    );

    await request(app).put('/').set('Cookie', sessionCookie);

    const [updatedSession] = await prisma.otherSession.findMany();
    expect(JSON.parse(updatedSession.data!)).toStrictEqual(
      expect.objectContaining({
        data: 'UPDATED',
      })
    );
  });
});
