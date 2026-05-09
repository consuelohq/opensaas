import { type CanActivate } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { type Request, type Response } from 'express';
import { Readable } from 'stream';

import { FilesFieldService } from 'src/engine/core-modules/file/files-field/files-field.service';
import { FilesFieldGuard } from 'src/engine/core-modules/file/files-field/guards/files-field.guard';
import { FileApiExceptionFilter } from 'src/engine/core-modules/file/filters/file-api-exception.filter';
import {
  FILE_RESPONSE_CONTENT_SECURITY_POLICY,
  FILE_RESPONSE_CONTENT_TYPE_OPTIONS,
} from 'src/engine/core-modules/file/utils/set-file-response-security-headers.utils';

import { FilesFieldController } from './files-field.controller';

const createMockStream = () => {
  const mockStream = new Readable();

  mockStream.push('file content');
  mockStream.push(null);
  mockStream.pipe = jest.fn() as unknown as typeof mockStream.pipe;

  return mockStream;
};

const createMockResponse = () =>
  ({
    setHeader: jest.fn(),
  }) as unknown as Response;

describe('FilesFieldController', () => {
  let controller: FilesFieldController;
  let filesFieldService: FilesFieldService;
  const mockFilesFieldGuard: CanActivate = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesFieldController],
      providers: [
        {
          provide: FilesFieldService,
          useValue: {
            getFileStream: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(FilesFieldGuard)
      .useValue(mockFilesFieldGuard)
      .overrideFilter(FileApiExceptionFilter)
      .useValue({})
      .compile();

    controller = module.get<FilesFieldController>(FilesFieldController);
    filesFieldService = module.get<FilesFieldService>(FilesFieldService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get file stream by id and workspace id', async () => {
    const mockStream = createMockStream();

    jest.spyOn(filesFieldService, 'getFileStream').mockResolvedValue(mockStream);

    const mockRequest = {
      workspaceId: 'workspace-id',
    } as unknown as Request;

    const mockResponse = createMockResponse();

    await controller.getFileById(mockResponse, mockRequest, 'file-id');

    expect(filesFieldService.getFileStream).toHaveBeenCalledWith({
      fileId: 'file-id',
      workspaceId: 'workspace-id',
    });
  });

  it('should set security headers before streaming file content', async () => {
    const mockStream = createMockStream();

    jest.spyOn(filesFieldService, 'getFileStream').mockResolvedValue(mockStream);

    const mockRequest = {
      workspaceId: 'workspace-id',
    } as unknown as Request;

    const mockResponse = createMockResponse();

    await controller.getFileById(mockResponse, mockRequest, 'file-id');

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      FILE_RESPONSE_CONTENT_SECURITY_POLICY,
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      FILE_RESPONSE_CONTENT_TYPE_OPTIONS,
    );
    expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
  });
});
