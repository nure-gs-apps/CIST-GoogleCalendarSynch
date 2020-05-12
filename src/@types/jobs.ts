import { Nullable } from './';

export interface IEntitiesToOperateOn {
  groups: boolean;
  auditories: boolean;
  events: Nullable<number[]>; // empty means all
}
