# SQS message processor

## Install

This project may be open-sourced at some point, but until then, follow instructions in the [Appfolio npm repository wiki](https://sites.google.com/a/appfolio.com/eng/resources/our-tools/npm?pli=1) to enable our private npm repository in you project, then

    npm install sokoban

or

    yarn add sokoban

#### Supported Node.js versions

The package is currently compiled to `ES2017` and `common.js`, thus is compatible with `Node 8.x`. If there is any need to support earlier version of Node.js, a PR to change the `typescript` target version is sufficient.

## Usage

At this point, this package only process messages from a single SQS queue.  However, it supports multiple job handlers. Here is a quick sample of using the library:

    import { Config, Message, SqsProcessor } from 'sokoban';

    const config: Config = {
        aws: {
            region: '<AWS region for the queue>',
            accessKeyId: '<AWS credential>',
            secretAccessKey: '<AWS credential>',
        }
        logLevel: 'info',
        message: {
            jobClassAttributeName: 'job_class',
            bodyFormat: 'json'
        },
        queue: {
            url: '<SQS queue URL>',
            longPollingTImeSeconds: 5,
            maxFetchingDelaySeconds: 60,
            driveMode: 'loop',
        },
    }
    const processor: SqsProcessor = new SqsProcessor(config);

    processor.on('default', (msg: Message) => {});
    processor.on('job1', (msg: Message) => {});

    processor.start();

### Config options

Constructor of the `SqsProcessor` class takes a config object.  The supported options are:

- **aws**: [optional] Your AWS region and credentials.  If omitted, whatever configuration is available on your system is used.  See [here](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html).

- **logLevel**: [optional] Verbose level for logging.  `sokoban` uses [loglevel](https://github.com/pimterry/loglevel) for logging.  Allowed levels are: `trace`, `info`(default), `warn`, `error`, and `silent`.

- **message**: [optional] Message related configurations.
    - **jobClassAttributeName**: [optional] `sokoban` support multiple job handlers.  This option specifies the special key to use in `MessageAttributes` of a SQS message to identify a job handler.  If not specified, the queue processor always looks for the `default` handler to process jobs in the queue.

    - **bodyFormat**: [optional] Format of the message body, may be either `json` or `string` (default).

- **queue**: [required] Queue related configurations.
    - **url**: [required] SQS queue URL
    - **longPollingTImeSeconds**: [optional] `sokoban` use SQS's build-in long-polling mechanism to poll messages if not enough messages are immediate available in the queue.  This options tells SQS how long to wait for messages before giving up. Default to 5 seconds. See [here](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-long-polling.html).

    - **maxFetchingDelaySeconds**: [optional] When the queue processor failed to receive messages for the queue, it will retry with Fibonacci backoff.  This option specifies the maximum delay on retry.  Default to 60 seconds.

    - **driveMode**: [optional] This determines how the processor behavior in terms of fetching queue messages.  3 modes are supported:
        - 'deplete' (default): keep fetch and process messages until the queue is depleted;
        - 'loop': keep fetch messages indefinitely even after the queue is empty;
        - 'single': only fetch and process messages once.  This mode is mostly for testing purpose.

    - **maxFetchingRetry**: [optional] How many times to retry when error occurs during fetching messages. This option is only effective when the queue drive mode is `deplete`.  Default to `0`, does not retry.

### Job handlers

All job handlers have a simple function signature defined as

    export type JobHandler = (message: Message) => void;

The handler is passed a message object with this type definition:

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

These type definitions may all be imported from `sokoban`.

`SqsProcessor` has a `on` method to register a job handler:

    const job_handler: JobHandler = (msg: Message) => { ... };
    processor.on('job_class_name', job_handler);

There is one special job class named 'default'.  The queue process use this handler if `message.jobClassAttributeName` is not defined in the config object, or if a message does not have a job class speficied in its `MessageAttributes`.  The default handler is registered the same way as any other handlers:

    processor.on('default', default_handler);

### Driver

The queue processor is started by running

    processor.start();

If you want to handle any exception might leak out of the processor, you can call `then` or `catch` on the return value since the `start()` function returns a promise.

    processor.start().catch(err => { ... });
