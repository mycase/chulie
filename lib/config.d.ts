export interface AwsConfig {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface QueueConfig {
  readonly url: string;
  readonly longPollingTimeSeconds: number;
  readonly maxFetchingDelaySeconds: number;
}

export interface MessageConfig {
  readonly jobClassAttributeName?: string;
  readonly bodyFormat?: 'json' | 'string';
}

export interface Config {
  aws?: AwsConfig;
  logLevel: string;
  message: MessageConfig;
  queue: QueueConfig;
}

export default Config;
