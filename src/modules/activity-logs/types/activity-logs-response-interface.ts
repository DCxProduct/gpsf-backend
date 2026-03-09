export interface ActivityLogsResponseInterface {
  items: Array<{
    id: number;
    kind: string;
    activity: string;
    module: string;
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
    date: Date;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
