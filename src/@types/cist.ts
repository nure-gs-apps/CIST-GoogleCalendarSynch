import { AxiosResponse } from 'axios';
import { capitalCase } from 'change-case';
import { DeepReadonly, Nullable } from './index';

export enum EntityType {
  Events= 'events',
  Groups = 'groups',
  Rooms = 'rooms'
}

export interface ICistJsonClient {
  getRoomsResponse(): Promise<CistRoomsResponse>;
  getGroupsResponse(): Promise<CistGroupsResponse>;
  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>,
  ): Promise<CistEventsResponse>;
}

export interface ICistJsonHttpParserService {
  parseRoomsResponse(response: AxiosResponse): CistRoomsResponse;
  parseGroupsResponse(response: AxiosResponse): CistGroupsResponse;
  parseEventsResponse(response: AxiosResponse): CistEventsResponse;
}

export class ThrowCistJsonClient implements ICistJsonClient {
  private static _getInstance: Nullable<ThrowCistJsonClient> = null;
  public static getInstance() {
    if (!this._getInstance) {
      this._getInstance = new ThrowCistJsonClient();
    }
    return this._getInstance;
  }

  private constructor() {
  }

  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>
  ): Promise<CistEventsResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

  getGroupsResponse(): Promise<CistGroupsResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

  getRoomsResponse(): Promise<CistRoomsResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

}

export interface CistRoomsResponse {
  university: {
    short_name: string;
    full_name: string;
    buildings: CistBuilding[];
  };
}

export interface CistGroupsResponse {
  university: {
    short_name: string;
    full_name: string;
    faculties: CistFaculty[];
  };
}

export interface CistEventsResponse {
  'time-zone': string;
  events: CistEvent[];
  groups: CistGroup[];
  teachers: CistTeacher[];
  subjects: CistSubject[];
  types: CistEventType[];
}

export interface CistBuilding {
  id: string; // the same as short_name, but don't rely
  short_name: string;
  full_name: string;
  auditories: CistRoom[];
}

export interface CistRoom {
  id: string;
  short_name: string;
  floor: string; // number in fact
  is_have_power: string; // string one or (presumably) zero
  auditory_types: CistRoomType[];
}

export interface CistRoomType {
  id: string;
  short_name: string; // (presumably) direction (branch)
}

export interface CistFaculty {
  id: number;
  short_name: string;
  full_name: string;
  directions: CistDirection[];
}

export interface CistDirection {
  id: number;
  short_name: string;
  full_name: string;
  groups?: CistGroup[];
  specialities: CistSpeciality[];
}

export interface CistSpeciality {
  id: number;
  short_name: string;
  full_name: string;
  groups: CistGroup[];
}

export interface CistGroup {
  id: number;
  name: string;
}

export interface CistEvent {
  subject_id: number;
  start_time: number;
  end_time: number;
  type: EventType;
  number_pair: number;
  auditory: string;
  teachers: number[];
  groups: number[];
}

export interface CistTeacher {
  id: number;
  short_name: string;
  full_name: string;
}

export interface CistSubject {
  id: number;
  brief: string;
  title: string;
  hours: CistSubjectHour[];
}

export interface CistSubjectHour { // TODO: check, how to use
  type: number;
  val: number;
  teachers: number[];
}

export interface CistEventType { // for course work: #BFC9CA
  id: number;
  short_name: string;
  full_name: string;
  id_base: number;
  type: string;
}

export enum EventType {
  Lecture = 0,
  ExtramuralInitialLecture = 1,
  TermInitialLecture = 2,

  Practice = 10,
  Seminar = 11,
  ExtramuralPractice = 12,

  LabWork = 20,
  ComputerCenterLabWork = 21,
  DirectionLabWork = 22,
  InitialLabWork = 23,
  InitialDirectionLabWork = 24,

  Consultation = 30,
  VoluntaryConsultation = 31,

  Test = 40,
  DifferentiatedTest = 41,

  Exam = 50,
  WrittenExam = 51,
  OralExam = 52,
  CompositeExam = 53,
  TestExam = 54,
  ModularExam = 55,

  CourseWork = 60,
}

export function asReadableType(type: EventType) {
  return capitalCase(EventType[type]);
}

export interface IEventsQueryParams {
  typeId: TimetableType;
  dateLimits?: IDateLimits;
  entityId: number | string;
}

export enum TimetableType {
  Group = 1,
  Teacher = 2,
  Room = 3,
}

export interface IDateLimits {
  from?: Date;
  to?: Date;
}
