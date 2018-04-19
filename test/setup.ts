process.env.NODE_ENV = 'test';

import logger from '../lib/logger';
logger.setLevel('silent');
