import { ActivityLogChanges, ActivityLogMetadata } from '../activity-log.entity';

export interface ActivityLogResponseInterface {
  id: number;
  kind: string;
  activity: string;
  module: string;
  resource: string;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  target: {
    id: number | null;
    type: string | null;
    label: string | null;
    url: string | null;
  };
  changes: ActivityLogChanges | null;
  metadata: ActivityLogMetadata | null;
  date: Date;
}
