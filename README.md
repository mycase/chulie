# MyCase Asynchronous Job Dispatching Center

This repo documents and implements MyCase asynchronous job dispatching system.  This system is primarily used to dispatch jobs generated outside of MyCase App to proper shards, or re-dispatch jobs that were lost because their associated firms were moved from a shard to another.

## Design

The system consists of an job incoming queue (`dispatching queue`) and a Node.js service (`dispatcher`) that watches the dispatching queue.  For any job in the dispatching queue, the dispatcher dispatches it to an application queue beloging to a proper shard. The job is then processed by the background workers of *mycase_app*.  Here is a sequence diagram of the process:

![Dispatcher Design Diagram](doc/dispatcher.png)

Any job sent to the dispatching queue should have at minimum a firm UUID and a shoryuken job class, based on which the dispatch may then find the proper application queue to send the job to.

For MyCase2 MVP, this `dispatcher` is only used to dispatch outside jobs, since firms won't be moved between shards.  However, to support the lost-and-found function in the future, a Shoryuken middleware needs to be added in the application to send lost jobs to the `dispatching queue`.  Logic for this middleware is very simple and straightforward:

![Re-dispatching Logic Diagram](doc/re-dispatching_logic.png)

## Development

### Run the dispatcher in Docker

This service is completely Dockerized.  The easiest way to run it by using [DevTk](https://github.com/appfolio/mc_devtk):

- Build a Docker image:

        devtk image build

- Run the service:

        devtk service up

- Run tests:

        devtk service test yarn test

### Run the dispatcher natively

You may also run the service or tests natively without Docker if you have Node 8.10 installed:

    yarn start:dev
    yarn test
