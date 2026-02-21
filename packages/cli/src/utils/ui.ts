import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { intro, outro, log as clackLog } from '@clack/prompts';
import { log } from '../output.js';

export function printBanner(steps?: string[]): void {
  log('');
  intro(chalk.bold.white('C O N S U E L O'));
  log(`${chalk.dim('│')}`);
  log(`${chalk.dim('│')}  ${chalk.white('make more sales.')}`);
  if (steps?.length) {
    log(`${chalk.dim('│')}`);
    for (const step of steps) {
      log(`${chalk.dim('│')}  ${chalk.dim('○')}  ${chalk.dim(step)}`);
    }
  }
  log(`${chalk.dim('│')}`);
}

export function stepComplete(label: string): void {
  log(`${chalk.dim('│')}  ${chalk.white('●')}  ${chalk.white(label)}`);
}

export function printEnd(): void {
  outro(chalk.white('win the day!'));
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'white' });
}

export function success(msg: string): void {
  clackLog.success(msg);
}

export function info(msg: string): void {
  clackLog.info(msg);
}
