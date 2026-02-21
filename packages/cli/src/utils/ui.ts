import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { intro, outro, log as clackPrompts } from '@clack/prompts';

export function printBanner(steps?: string[]): void {
  clackPrompts.message('');
  intro(chalk.bold.white('C O N S U E L O'));
  clackPrompts.message(`${chalk.dim('│')}`);
  clackPrompts.message(`${chalk.dim('│')}  ${chalk.white('make more sales.')}`);
  if (steps?.length) {
    clackPrompts.message(`${chalk.dim('│')}`);
    for (const step of steps) {
      clackPrompts.message(
        `${chalk.dim('│')}  ${chalk.dim('○')}  ${chalk.dim(step)}`,
      );
    }
  }
  clackPrompts.message(`${chalk.dim('│')}`);
}

export function stepComplete(label: string): void {
  clackPrompts.message(
    `${chalk.dim('│')}  ${chalk.white('●')}  ${chalk.white(label)}`,
  );
}

export function printEnd(): void {
  outro(chalk.white('win the day!'));
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'white' });
}

export function success(msg: string): void {
  clackPrompts.success(msg);
}

export function info(msg: string): void {
  clackPrompts.info(msg);
}
