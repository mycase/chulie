# chulie

AWS SQS message processor for Node.js

## Installation

    npm install chulie

or

    yarn add chulie

### Supported Node.js versions

This package is written in TypeScript and is currently configured to compile to
`ES2017` and `commonjs`. Thus, it's compatible with `Node 8.x` and above.

## Usage

Currently `chulie` only processes messages from a single SQS queue. However, it
supports multiple job handlers. Here is a quick sample of using the library:

```ts
import { Config, Message, SqsProcessor } from 'chulie';

const config: Config = {
    aws: {
        region: '<AWS region for the queue>',
        accessKeyId: '<AWS credential>',
        secretAccessKey: '<AWS credential>'
    }
    logLevel: 'info',
    message: {
        jobClassAttributeName: 'job_class',
        bodyFormat: 'json'
    },
    queue: {
        url: '<SQS queue URL>',
        longPollingTimeSeconds: 5,
        maxFetchingDelaySeconds: 60,
        driveMode: 'loop'
    }
}
const processor: SqsProcessor = new SqsProcessor(config);

processor.on('default', (msg: Message) => { /* ... */ });
processor.on('job1', (msg: Message) => { /* ... */ });

processor.start();
```

### Config options

The constructor of the `SqsProcessor` class takes a config object whose
supported options are:

- **aws**: [optional] An object containing the AWS `region`, `accessKeyId`, and
  `secretAccessKey`. If omitted, whatever configuration is available on your
   system is used. See the corresponding [AWS JavaScript SDK docs].

- **logLevel**: [optional] Verbosity level for logging. `chulie` uses
  [`loglevel`] for logging. Allowed levels are: `trace`, `info` (default),
  `warn`, `error`, and `silent`.

- **message**: [optional] Message related configurations
    - **jobClassAttributeName**: [optional] `chulie` supports multiple job
      handlers. This option specifies the special key to use in the
      `MessageAttributes` of an SQS message to identify a job handler. If not
      specified, the queue processor always looks for the `default` handler to
      process jobs in the queue.

    - **bodyFormat**: [optional] Format of the message body - may be either
      `json` or `string` (default).

- **queue**: [required] Queue related configurations
    - **url**: [required] SQS queue URL

    - **longPollingTimeSeconds**: [optional] `chulie` use SQS's built-in
      long-polling mechanism to poll for messages if not enough messages are
      immediately available in the queue. This option tells SQS how long to wait
      for messages before giving up. Defaults to 5 seconds. See the
      [AWS SQS docs].

    - **maxFetchingDelaySeconds**: [optional] When the queue processor fails to
      receive messages from the queue, it will retry with Fibonacci backoff.
      This option specifies the maximum delay on retry. Defaults to 60 seconds.

    - **driveMode**: [optional] This determines how the processor behaves in
      terms of fetching queue messages. 3 modes are supported:
        - 'deplete' (default): Keep fetching and processing messages until the
          queue is depleted.
        - 'loop': Keep fetching messages indefinitely even after the queue is
          empty.
        - 'single': Only fetch and process messages once. This mode is mostly
          for testing purposes.

    - **maxFetchingRetry**: [optional] How many times to retry when an error
      occurs while fetching messages. This option is only effective when the
      queue drive mode is `deplete`. Defaults to `0` (no retries).

[AWS JavaScript SDK docs]: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html
[`loglevel`]: https://github.com/pimterry/loglevel
[AWS SQS docs]: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-long-polling.html

### Job handlers

All job handlers have a simple function signature defined as

```ts
export type JobHandler = (message: Message) => void;
```

The handler is passed a message object with this type definition:

```ts
export type JsonObject = boolean | number | string | null | JsonArray | JsonHash;

interface JsonHash {
    [key: string]: JsonObject;
}

interface JsonArray extends Array<JsonObject> {}

export interface MessageAttributes {
    [name: string]: string;
}

export type MessageBody = string | JsonObject;

export interface Message {
    originalMessage: SQS.Message;
    id: string;
    attributes: MessageAttributes;
    jobClass: string;
    body: MessageBody;
}
```

These type definitions may all be imported from `chulie`.

`SqsProcessor` has an `on` method to register a job handler:

```ts
const job_handler: JobHandler = (msg: Message) => { /* ... */ };
processor.on('job_class_name', job_handler);
```

There is one special job class named 'default'. The queue process uses this
handler if `message.jobClassAttributeName` is not defined in the config object,
or if a message does not have a job class specified in its `MessageAttributes`.
The default handler is registered the same way as any other handler:

```ts
processor.on('default', default_handler);
```

### Driver

The queue processor is started by running

```ts
processor.start();
```

If you want to handle any exception that might leak out of the processor, you
can call `then` or `catch` on the return value since the `start()` function
returns a `Promise`.

```ts
processor.start().catch(err => { /* ... */ });
```
