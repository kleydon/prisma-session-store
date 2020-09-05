export const createPrismaMock = () => {
  const createMock = jest.fn();
  const deleteMock = jest.fn();
  const deleteManyMock = jest.fn();
  const findManyMock = jest.fn();
  const findOneMock = jest.fn();
  const updateMock = jest.fn();

  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    session: {
      create: createMock,
      delete: deleteMock,
      deleteMany: deleteManyMock,
      findMany: findManyMock,
      findOne: findOneMock,
      update: updateMock,
    },
  };

  return [
    prisma,
    {
      createMock,
      deleteMock,
      deleteManyMock,
      findManyMock,
      findOneMock,
      updateMock,
    },
  ] as const;
};
