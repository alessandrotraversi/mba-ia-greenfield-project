import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import { VideosService, type UploadSession } from './videos.service';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload-session')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Start a video upload session',
    description:
      'Pre-registers a draft video under the authenticated channel and returns a presigned MinIO PUT URL for the client to upload the file directly.',
  })
  @ApiResponse({
    status: 201,
    description: 'Upload session created',
    schema: {
      properties: {
        videoId: { type: 'string', format: 'uuid' },
        uploadUrl: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        storageKey: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'File too large or unsupported content type',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async createUploadSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUploadSessionDto,
  ): Promise<UploadSession> {
    return this.videosService.createUploadSession(user.sub, dto);
  }

  @Get(':id/stream')
  @Public()
  @ApiOperation({
    summary: 'Stream or download a video',
    description:
      'Serves a ready video from MinIO. Honors the HTTP Range header for playback/seek (206 Partial Content); returns the full byte stream (200) when no Range header is sent.',
  })
  @ApiParam({ name: 'id', description: 'Video id (UUID)' })
  @ApiResponse({ status: 200, description: 'Full video byte stream' })
  @ApiResponse({
    status: 206,
    description: 'Partial content for the requested byte range',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready for playback',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 416,
    description: 'Requested range is outside the video size',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async streamVideo(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const stream = await this.videosService.streamVideo(id, range);
    res.status(stream.statusCode);
    res.set(stream.headers);
    stream.body.pipe(res);
  }
}
