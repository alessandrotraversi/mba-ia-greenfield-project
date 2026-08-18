import { DomainException } from '../../common/exceptions/domain.exception';

export class FileTooLargeException extends DomainException {
  constructor() {
    super('FILE_TOO_LARGE', 400, 'File size exceeds the 10GB upload limit');
  }
}

export class UnsupportedContentTypeException extends DomainException {
  constructor() {
    super(
      'UNSUPPORTED_CONTENT_TYPE',
      400,
      'Content type is not a supported video format',
    );
  }
}

export class VideoNotFoundException extends DomainException {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
  }
}

export class VideoNotReadyException extends DomainException {
  constructor() {
    super('VIDEO_NOT_READY', 409, 'Video is not ready for playback');
  }
}

export class RangeNotSatisfiableException extends DomainException {
  constructor() {
    super(
      'RANGE_NOT_SATISFIABLE',
      416,
      'Requested range is outside the video size',
    );
  }
}
