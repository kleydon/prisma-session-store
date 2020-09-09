export const createPrismaMock = () => {
  const connectMock = jest.fn();
  const disconnectMock = jest.fn();

  const createMock = jest.fn();
  const deleteMock = jest.fn();
  const deleteManyMock = jest.fn();
  const findManyMock = jest.fn();
  const findOneMock = jest.fn();
  const updateMock = jest.fn();

  const prisma = {
    $connect: connectMock,
    $disconnect: disconnectMock,
    session: {
      create: createMock,
      delete: deleteMock,
      deleteMany: deleteManyMock,
      findMany: findManyMock,
      findOne: findOneMock,
      update: updateMock,
    },
  };

  connectMock.mockResolvedValue(undefined);
  disconnectMock.mockResolvedValue(undefined);
  findOneMock.mockResolvedValue(null);
  findManyMock.mockResolvedValue([]);
  deleteManyMock.mockResolvedValue([]);

  deleteMock.mockRejectedValue('Could not find ID');

  return [
    prisma,
    {
      connectMock,
      disconnectMock,
      createMock,
      deleteMock,
      deleteManyMock,
      findManyMock,
      findOneMock,
      updateMock,
    },
  ] as const;
};
