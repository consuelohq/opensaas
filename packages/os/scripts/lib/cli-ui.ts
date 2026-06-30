import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { intro, outro, log as clackLog } from '@clack/prompts';

type OsBannerStep =
  | string
  | {
      label: string;
      state?: 'pending' | 'active' | 'complete' | 'failed';
    };

const stepLabel = (step: OsBannerStep): string =>
  typeof step === 'string' ? step : step.label;

const stepSymbol = (step: OsBannerStep): string => {
  if (typeof step === 'string' || step.state === 'pending') return chalk.dim('○');
  if (step.state === 'active') return chalk.blue('◆');
  if (step.state === 'failed') return chalk.red('×');
  return chalk.green('●');
};

const stepText = (step: OsBannerStep): string => {
  const label = stepLabel(step);
  if (typeof step === 'string' || step.state === 'pending') return chalk.dim(label);
  if (step.state === 'complete') return chalk.green(label);
  if (step.state === 'failed') return chalk.red(label);
  return chalk.white(label);
};

export function printOsBanner(steps?: OsBannerStep[]): void {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold.white('CONSUELO OS'));
  lines.push(chalk.dim('|'));
  lines.push(`${chalk.dim('|')}  ${chalk.white('One workspace. Any agent.')}`);
  if (steps?.length) {
    lines.push(chalk.dim('|'));
    for (const step of steps) {
      lines.push(`${chalk.dim('|')}  ${stepSymbol(step)}  ${stepText(step)}`);
    }
  }
  lines.push(chalk.dim('|'));
  process.stdout.write(`${lines.join('\n')}\n`);
}

export function startIntro(): void {
  intro(chalk.white('Consuelo OS'));
}

export function stepComplete(label: string): void {
  clackLog.message(`${chalk.dim('|')}  ${chalk.white('*')}  ${chalk.white(label)}`);
}

export function printEnd(message = 'OS ready'): void {
  outro(chalk.white(message));
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'white' });
}

export function success(message: string): void {
  clackLog.success(message);
}

export function info(message: string): void {
  clackLog.info(message);
}

export function warn(message: string): void {
  clackLog.warn(message);
}
