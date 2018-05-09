import { MessageBodyFormat } from './message';

export interface AwsConfig {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface QueueConfig {
  readonly url: string;
  readonly longPollingTimeSeconds?: number;
  readonly maxFetchingDelaySeconds?: number;
}

export interface MessageConfig {
  readonly jobClassAttributeName?: string;
  readonly bodyFormat?: MessageBodyFormat;
}

export interface Config {
  aws?: AwsConfig;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
  message?: MessageConfig;
  queue: QueueConfig;
}
