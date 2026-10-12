import { run } from './run';
import { arena } from './arena';
import { levels } from './levels';
import { scenes } from './scenes';
import { battle } from './battle';
import { screens } from './screens';
import { meta } from './meta';

export const EN: Record<string, string> = {
  ...run,
  ...arena,
  ...levels,
  ...scenes,
  ...battle,
  ...screens,
  ...meta,
};
