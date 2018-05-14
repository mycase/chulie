import { MessageBodyFormat } from './message';
import { LogLevelDesc } from 'loglevel';

export type QueueDriveMode = 'loop' | 'deplete' | 'single';

export interface AwsConfig {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface QueueConfig {
  readonly url: string;
  readonly longPollingTimeSeconds?: number;
  readonly maxFetchingDelaySeconds?: number;
  readonly driveMode?: QueueDriveMode;
  readonly maxFetchingRetry?: number;
}

export interface MessageConfig {
  readonly jobClassAttributeName?: string;
  readonly bodyFormat?: MessageBodyFormat;
}

export interface Config {
  aws?: AwsConfig;
  logLevel?: LogLevelDesc;
  message?: MessageConfig;
  queue: QueueConfig;
}
