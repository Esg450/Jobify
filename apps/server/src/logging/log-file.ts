import path from 'node:path';
import { loadConfig } from '../config/configuration.js';
import { RotatingFile } from './rotating-file.js';

/** Shared by the logger and the download endpoint: `<DATA_DIR>/logs/jobify.log`. */
export const LOG_FILE = new RotatingFile(path.join(loadConfig().dataDir, 'logs', 'jobify.log'));
