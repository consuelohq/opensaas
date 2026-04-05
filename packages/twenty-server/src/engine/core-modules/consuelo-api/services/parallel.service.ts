import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class ParallelService {
  async initiateParallelDial() {
    throw new NotImplementedException('DEV-1459: parallel dial migration in progress');
  }

  async validateParallelDial() {
    throw new NotImplementedException('DEV-1459: parallel validation migration in progress');
  }

  async statusCallback() {
    throw new NotImplementedException('DEV-1459: status callback migration in progress');
  }

  async customerTwiml() {
    throw new NotImplementedException('DEV-1459: customer TwiML migration in progress');
  }

  async getGroupStatus() {
    throw new NotImplementedException('DEV-1459: group status migration in progress');
  }

  async terminateGroup() {
    throw new NotImplementedException('DEV-1459: terminate group migration in progress');
  }
}
