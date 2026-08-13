import { toolPackage as package0 } from './artifacts/manifest';
import { toolPackage as package1 } from './codemode/manifest';
import { toolPackage as package2 } from './composed/manifest';
import { toolPackage as package3 } from './decision-engine/manifest';
import { toolPackage as package4 } from './filesystem/manifest';
import { toolPackage as package5 } from './generation/manifest';
import { toolPackage as package6 } from './git/manifest';
import { toolPackage as package7 } from './github/manifest';
import { toolPackage as package8 } from './http/manifest';
import { toolPackage as package9 } from './linear/manifest';
import { toolPackage as package10 } from './mac/manifest';
import { toolPackage as package11 } from './media/manifest';
import { toolPackage as package12 } from './memory/manifest';
import { toolPackage as package13 } from './review/manifest';
import { toolPackage as package14 } from './sentry/manifest';
import { toolPackage as package15 } from './stream/manifest';
import { toolPackage as package16 } from './subagent/manifest';
import { toolPackage as package17 } from './task-lifecycle/manifest';
import { toolPackage as package18 } from './tool-discovery/manifest';
import { toolPackage as package19 } from './utilities/manifest';
import { toolPackage as package20 } from './deployment-provider/manifest';
import { toolPackage as package21 } from './lifecycle/manifest';

import type { ToolPackage } from './package';

export const toolPackages = [
  package0,
  package1,
  package2,
  package3,
  package4,
  package5,
  package6,
  package7,
  package8,
  package9,
  package10,
  package11,
  package12,
  package13,
  package14,
  package15,
  package16,
  package17,
  package18,
  package19,
  package20,
  package21,
] satisfies readonly ToolPackage[];
