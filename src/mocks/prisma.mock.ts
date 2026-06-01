export const createPrismaMock = () => {
  const connectMock = jest.fn();
  const disconnectMock = jest.fn();
  const executeRawUnsafeMock = jest.fn();

  const createMock = jest.fn();
  const deleteMock = jest.fn();
  const deleteManyMock = jest.fn();
  const findManyMock = jest.fn();
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();

  const otherCreateMock = jest.fn();
  const otherDeleteMock = jest.fn();
  const otherDeleteManyMock = jest.fn();
  const otherFindManyMock = jest.fn();
  const otherFindUniqueMock = jest.fn();
  const otherUpdateMock = jest.fn();

  const prisma = {
    $connect: connectMock,
    $disconnect: disconnectMock,
    $executeRawUnsafe: executeRawUnsafeMock,
    session: {
      create: createMock,
      delete: deleteMock,
      deleteMany: deleteManyMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },

    otherSession: {
      create: otherCreateMock,
      delete: otherDeleteMock,
      deleteMany: otherDeleteManyMock,
      findMany: otherFindManyMock,
      findUnique: otherFindUniqueMock,
      update: otherUpdateMock,
    },
  };

  connectMock.mockResolvedValue(undefined);
  disconnectMock.mockResolvedValue(undefined);
  executeRawUnsafeMock.mockResolvedValue(undefined);
  findUniqueMock.mockResolvedValue(null);
  findManyMock.mockResolvedValue([]);
  deleteManyMock.mockResolvedValue([]);

  deleteMock.mockRejectedValue('Could not find ID');

  return [
    prisma,
    {
      connectMock,
      disconnectMock,
      executeRawUnsafeMock,
      createMock,
      deleteMock,
      deleteManyMock,
      findManyMock,
      findUniqueMock,
      updateMock,
      otherCreateMock,
      otherDeleteMock,
      otherDeleteManyMock,
      otherFindManyMock,
      otherFindUniqueMock,
      otherUpdateMock,
    },
  ] as const;
};
