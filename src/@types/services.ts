export interface IApiQuota {
  daily: number;
  period: number;
  queries: number;
  perSecond?: number;
  burst: boolean;
}
