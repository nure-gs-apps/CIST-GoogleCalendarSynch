import { Nullable } from './';

export interface IEntitiesToOperateOn {
  auditories: boolean;
  groups: boolean;
  events: Nullable<number[]>; // empty array means all
}
