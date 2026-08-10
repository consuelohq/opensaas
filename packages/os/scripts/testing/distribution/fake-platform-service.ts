export type PlatformServiceOperation =
  | 'install'
  | 'restart'
  | 'start'
  | 'stop'
  | 'uninstall';

export class FakePlatformService {
  readonly operations: PlatformServiceOperation[] = [];

  constructor(
    private readonly failOperation: PlatformServiceOperation | null = null,
  ) {}

  async run(operation: PlatformServiceOperation): Promise<void> {
    this.operations.push(operation);
    if (operation === this.failOperation) {
      throw new Error(`Injected platform service failure at ${operation}.`);
    }
  }
}
