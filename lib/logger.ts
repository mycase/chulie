import loggerL from 'loglevel';

const logger = loggerL.getLogger('sokoban_logger');

if (logger.methodFactory === loggerL.methodFactory) {
  const originalFactory = logger.methodFactory;
  logger.methodFactory = (methodName, logLevel, loggerName) => {
    const rawMethod = originalFactory(methodName, logLevel, loggerName);
    if (methodName === 'error') {
      return (message: string, err?: Error) => {
        if (err) message = message.concat(` Error: ${err}\n  ${err.stack}`);
        rawMethod(message);
      };
    }
    return (message: string) => rawMethod(message);
  };
  logger.setLevel(logger.getLevel());
}

export default logger;
