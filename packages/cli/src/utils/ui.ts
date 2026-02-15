import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { intro, outro, log } from '@clack/prompts';

export function printBanner(steps?: string[]): void {
  // eslint-disable-next-line no-console -- clean UI output
  console.log();
  intro(chalk.bold.white('C O N S U E L O'));
  // eslint-disable-next-line no-console
  console.log(`${chalk.dim('│')}`);
  // eslint-disable-next-line no-console
  console.log(`${chalk.dim('│')}  ${chalk.white('make more sales.')}`);
  if (steps?.length) {
    // eslint-disable-next-line no-console
    console.log(`${chalk.dim('│')}`);
    for (const step of steps) {
      // eslint-disable-next-line no-console
      console.log(`${chalk.dim('│')}  ${chalk.dim('○')}  ${chalk.dim(step)}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`${chalk.dim('│')}`);
}

export function stepComplete(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`${chalk.dim('│')}  ${chalk.white('●')}  ${chalk.white(label)}`);
}

export function printEnd(): void {
  outro(chalk.white('win the day!'));
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'white' });
}

export function success(msg: string): void {
  log.success(msg);
}

export function info(msg: string): void {
  log.info(msg);
}
